/**
 * Streaming speech playback for the Natally voice surface.
 *
 * `speakStream(text)` is called repeatedly as the answer streams in (token
 * fragments are fine). Text is buffered and cut at sentence boundaries; each
 * complete sentence is dispatched to the synthesis worker (`./worker.ts`,
 * Supertonic TTS via transformers.js) and the returned PCM is scheduled
 * gaplessly on Web Audio with a short pause after every sentence, so delivery
 * paces with the sentence structure of the answer.
 *
 * Gesture gate (browser autoplay policy, by design): an AudioContext is
 * created only after `admit()` has marked a real user gesture. Until then
 * `speakStream` still buffers and queues the streamed text — so admitting
 * mid-answer picks it up — but reports the truthful error
 * `VOICE_NOT_ADMITTED` ('voice not admitted') through `onState`. It never
 * fakes playback and never drops the text silently.
 */

export const VOICE_NOT_ADMITTED = 'voice not admitted';

/** Speaker embeddings shipped with the model (`voices/*.bin` on the repo). */
export const SUPERTONIC_VOICES = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
] as const;

export type SupertonicVoice = (typeof SUPERTONIC_VOICES)[number];

/**
 * Voice used when `speakStream` is called without a `voice` option.
 * F5 (operator tuning 2026-11-08): high, bright, kawaii register per
 * SOUL.md — F1 read deep and slow.
 */
export const DEFAULT_VOICE: SupertonicVoice = 'F5';

/**
 * Feminine speakers auditioned for the default role (F5 won), exported so
 * the app can render a live audition UI later.
 */
export const VOICE_CANDIDATES = ['F1', 'F2', 'F3', 'F4', 'F5'] as const;

/**
 * TEMPORARY audition override (operator directive 2026-11-08, diagnostic
 * aid): `?voice=F1..F5|M1..M5` in the URL selects the speaker for that
 * session only, so each candidate can be auditioned live before the final
 * pick is baked into DEFAULT_VOICE. Invalid values fall back silently.
 */
function sessionVoice(): SupertonicVoice {
  if (typeof window === 'undefined') return DEFAULT_VOICE;
  const requested = new URLSearchParams(window.location.search).get('voice');
  return requested && (SUPERTONIC_VOICES as readonly string[]).includes(requested)
    ? (requested as SupertonicVoice)
    : DEFAULT_VOICE;
}

export interface SpeakOptions {
  /** Supertonic voice for the text in this call (per-sentence granularity). */
  voice?: SupertonicVoice;
  /**
   * End-of-stream marker: also synthesize buffered text that lacks closing
   * punctuation. Call `speakStream('', { flush: true })` once the answer has
   * fully arrived.
   */
  flush?: boolean;
}

export interface VoiceState {
  /** Whether a user gesture has admitted audio (`admit()`). */
  admitted: boolean;
  /** True while sentences are queued, synthesizing, or audible. */
  speaking: boolean;
  /** Last truthful failure ('voice not admitted', worker/model errors). */
  error: string | null;
}

/** Worker protocol (shared with ./worker.ts through type-only imports). */
export interface SynthRequest {
  type: 'synth';
  id: number;
  epoch: number;
  text: string;
  voice: SupertonicVoice;
}

export type ToWorker = SynthRequest | { type: 'reset'; epoch: number };

export type FromWorker =
  | {
      type: 'audio';
      id: number;
      epoch: number;
      sampleRate: number;
      audio: Float32Array<ArrayBuffer>;
    }
  | { type: 'error'; id: number; epoch: number; message: string };

/* ------------------------------------------------------------------ */
/* Sentence pacing                                                     */
/* ------------------------------------------------------------------ */

const SENTENCE_ENDERS = '.!?…';
const CJK_ENDERS = '。！？';
const CLOSERS = "\"'”’)]";
const SOFT_BREAK_PUNCT = ',;:—–-)]';
/** Force a cut past this many buffered chars so unpunctuated text still flows. */
const MAX_CHUNK = 300;
/** Never force a cut before this many chars. */
const MIN_CHUNK = 40;
/** Pause inserted after each scheduled sentence (seconds). */
const SENTENCE_GAP = 0.14;
/** Lead time before the first chunk of a stream starts (seconds). */
const SCHEDULE_AHEAD = 0.03;

function cut(
  buffer: string,
  endExclusive: number,
): { sentence: string | null; rest: string } {
  const sentence = buffer.slice(0, endExclusive).trim();
  return { sentence: sentence.length > 0 ? sentence : null, rest: buffer.slice(endExclusive) };
}

/**
 * Extract one sentence from the buffered stream text, or `null` while no
 * boundary is confirmed yet. A period directly followed by a word character
 * is punctuation inside a token ("3.5", "e.g."), and a period at the very end
 * of the buffer after a digit may still grow into a decimal, so both wait for
 * more text (or an explicit `flush`).
 */
function takeSentence(buffer: string): { sentence: string | null; rest: string } {
  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (ch === '\n') return cut(buffer, i);
    if (CJK_ENDERS.includes(ch)) return cut(buffer, i + 1);
    if (SENTENCE_ENDERS.includes(ch)) {
      let j = i + 1;
      while (
        j < buffer.length &&
        (SENTENCE_ENDERS.includes(buffer[j]) || CLOSERS.includes(buffer[j]))
      ) {
        j++;
      }
      if (j >= buffer.length) {
        // Punctuation ends the buffered text: sentence complete — unless it
        // may be a decimal still in flight ("15." before "3" arrives).
        const prev = i > 0 ? buffer[i - 1] : '';
        if (ch === '.' && prev >= '0' && prev <= '9') break;
        return cut(buffer, j);
      }
      if (/[A-Za-z0-9]/.test(buffer[j])) {
        i = j; // "3.5", "e.g." — punctuation inside a word, keep scanning
        continue;
      }
      return cut(buffer, j);
    }
  }
  return { sentence: null, rest: buffer };
}

/** Long text without sentence punctuation: cut at the last soft break. */
function forceChunk(buffer: string): { sentence: string | null; rest: string } {
  if (buffer.length < MAX_CHUNK) return { sentence: null, rest: buffer };
  const scanEnd = Math.min(buffer.length, MAX_CHUNK);
  let cutAt = -1;
  for (let k = MIN_CHUNK; k < scanEnd; k++) {
    const ch = buffer[k];
    if (ch === ' ' || ch === '\t') cutAt = k;
    else if (SOFT_BREAK_PUNCT.includes(ch)) cutAt = k + 1;
  }
  if (cutAt < 0) cutAt = scanEnd;
  return cut(buffer, cutAt);
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export function createSpeechEngine() {
  /** Session speaker (`?voice=` audition override): fixed at creation. */
  const session = sessionVoice();
  let admitted = false;
  let speaking = false;
  let error: string | null = null;
  /** Streamed text that has not formed a sentence yet. */
  let pending = '';
  /** Complete sentences waiting for the worker (with the voice they came with). */
  const queue: { text: string; voice: SupertonicVoice }[] = [];
  let ctx: AudioContext | null = null;
  let worker: Worker | null = null;
  let nextId = 0;
  /** Bumped by stop(); results from an older epoch are dropped. */
  let epoch = 0;
  /** Synthesis requests outstanding at the worker. */
  let inflight = 0;
  /** Web Audio time at which the next chunk will start. */
  let nextTime = 0;
  const activeSources = new Set<AudioBufferSourceNode>();
  const listeners = new Set<(state: VoiceState) => void>();

  function messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }


  function emit(): void {
    for (const cb of listeners) cb({ admitted, speaking, error });
  }

  function setError(message: string): void {
    if (error !== message) {
      error = message;
      emit();
    }
  }

  function refreshSpeaking(): void {
    const active =
      admitted && (queue.length > 0 || inflight > 0 || activeSources.size > 0);
    if (active !== speaking) {
      speaking = active;
      emit();
    }
  }

  /** Hard gesture gate: an AudioContext exists only once `admitted`. */
  function ensureContext(): AudioContext | null {
    if (ctx) return ctx;
    if (!admitted) return null;
    try {
      ctx = new AudioContext();
    } catch (err) {
      setError(`AudioContext unavailable: ${messageOf(err)}`);
      return null;
    }
    return ctx;
  }

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.addEventListener('message', (ev: MessageEvent<FromWorker>) => {
        onWorkerMessage(ev.data);
      });
      worker.addEventListener('error', (ev) => {
        setError(`voice worker failed: ${ev.message}`);
        refreshSpeaking();
      });
    }
    return worker;
  }

  function dispatch(): void {
    if (!admitted) return;
    const context = ensureContext();
    if (!context) {
      // No audio system: nothing can ever become audible for this text.
      queue.length = 0;
      refreshSpeaking();
      return;
    }
    if (context.state === 'suspended') {
      void context.resume().catch((err) => {
        setError(`audio blocked: ${messageOf(err)}`);
      });
    }
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      const request: SynthRequest = {
        type: 'synth',
        id: ++nextId,
        epoch,
        text: item.text,
        voice: item.voice,
      };
      inflight++;
      ensureWorker().postMessage(request);
    }
    refreshSpeaking();
  }

  function onWorkerMessage(msg: FromWorker): void {
    if (msg.epoch !== epoch) return; // belongs to a stopped stream
    inflight--;
    if (msg.type === 'error') {
      setError(msg.message);
      refreshSpeaking();
      return;
    }
    scheduleChunk(msg.audio, msg.sampleRate);
    refreshSpeaking();
  }

  function scheduleChunk(pcm: Float32Array<ArrayBuffer>, sampleRate: number): void {
    if (!ctx || pcm.length === 0) return;
    try {
      const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
      buffer.copyToChannel(pcm, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + SCHEDULE_AHEAD, nextTime);
      source.start(startAt);
      nextTime = startAt + buffer.duration + SENTENCE_GAP;
      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
        refreshSpeaking();
      };
    } catch (err) {
      setError(`audio scheduling failed: ${messageOf(err)}`);
    }
  }

  function feed(text: string, voice: SupertonicVoice, flush: boolean): void {
    pending += text;
    for (;;) {
      const taken = takeSentence(pending);
      pending = taken.rest;
      if (taken.sentence !== null) {
        queue.push({ text: taken.sentence, voice });
        continue;
      }
      const forced = forceChunk(pending);
      pending = forced.rest;
      if (forced.sentence !== null) {
        queue.push({ text: forced.sentence, voice });
        continue;
      }
      break;
    }
    if (flush) {
      const tail = pending.trim();
      pending = '';
      if (tail.length > 0) queue.push({ text: tail, voice });
    }
  }

  function speakStream(text: string, opts: SpeakOptions = {}): void {
    const voice = opts.voice ?? session;
    if (!SUPERTONIC_VOICES.includes(voice)) {
      setError(
        `unknown voice '${voice}' (available: ${SUPERTONIC_VOICES.join(', ')})`,
      );
      return;
    }
    feed(text, voice, opts.flush === true);
    if (!admitted) {
      // Buffered and queued; playback starts once a gesture admits audio.
      setError(VOICE_NOT_ADMITTED);
      return;
    }
    dispatch();
  }

  function stop(): void {
    epoch++; // invalidates every in-flight synthesis result
    pending = '';
    queue.length = 0;
    if (worker) worker.postMessage({ type: 'reset', epoch });
    for (const source of activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already finished on its own.
      }
    }
    activeSources.clear();
    if (ctx) nextTime = ctx.currentTime;
    inflight = 0; // outstanding results arrive with a stale epoch and are dropped
    error = null;
    speaking = false;
    emit();
  }

  function admit(): void {
    if (admitted) return;
    admitted = true;
    error = null; // clears the pre-admission 'voice not admitted' hold
    dispatch();
    emit();
  }

  function onState(cb: (state: VoiceState) => void): () => void {
    listeners.add(cb);
    cb({ admitted, speaking, error });
    return () => {
      listeners.delete(cb);
    };
  }

  return {
    speakStream,
    stop,
    admit,
    get admitted() {
      return admitted;
    },
    onState,
  };
}
