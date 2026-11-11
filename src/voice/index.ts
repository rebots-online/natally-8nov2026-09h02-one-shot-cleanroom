// Natally's voice for the app surface: one engine, the original's.
// The original voiceService (F4 speaker, pitch 1.15, soft tone, kawaii
// preset) synthesizes and plays every utterance, and emits the real
// per-word `natally-voice-performance` events — timed from the actual audio
// duration — that drive the verbatim AtelierCharacter's mouth. This module
// only adapts that engine to the streaming `Voice` interface the app uses
// (token fragments in, sentences out, gesture-gated admission) and mirrors
// word boundaries into `natally-karaoke` caption events.
//
// §8.1 items 2–4 on the speaking side: a speakStream issued while the model
// still loads waits for the load and then speaks (the queue is never
// silently dropped), and the next sentence's first chunk is synthesised in
// the worker while the current sentence plays — via speakNatallyText's
// `preparedAudio` seam, using the exact first chunk it would split itself —
// so playback is gapless across sentence boundaries, not just chunk
// boundaries within one utterance.

import {
 initSupertonic,
 splitSpeechText,
 subscribeVoiceStatus,
 supertonicSpeak,
 type LocalSpeech,
} from '../atelier-original/services/supertonicTts';
import {
 getSharedAudioContext,
 getSpeechPolicy,
 loadVoiceSettings,
 prepareSpeechWithOffsets,
 speakNatallyText,
 stopSpeaking,
} from '../atelier-original/services/voiceService';

export interface SpeakOptions {
 /**
  * End-of-utterance marker: also speak buffered text that lacks closing
  * punctuation. The next speakStream call after a flush starts a new
  * utterance and supersedes anything still audible.
  */
 flush?: boolean;
 /** Successful completion of this whole flushed utterance, never a cancelled one. */
 onComplete?: () => void;
}

export interface VoiceState {
 /** Whether a user gesture has admitted audio (`admit()`). */
 admitted: boolean;
 /** True while sentences are queued, synthesizing, or audible. */
 speaking: boolean;
 /** Last truthful engine failure, or null. */
 error: string | null;
}

/** Word-by-word caption progress for the karaoke line. */
export interface KaraokeDetail {
 line: string;
 wordIndex: number;
 wordCount: number;
}

export interface Voice {
 /**
  * Feed answer text; fragments are fine. Complete sentences are spoken in
  * order; `{ flush: true }` speaks the remainder. One utterance at a time:
  * the first call after a flush/stop cancels whatever is still audible.
  */
 speakStream(text: string, opts?: SpeakOptions): void;
 /** Stop queued and playing speech immediately; drop buffered text. */
 stop(): void;
 /** Admit audio; call inside a real click/key handler. */
 admit(): void;
 /** Whether audio has been admitted by a user gesture. */
 readonly admitted: boolean;
 /** Subscribe to state changes (invoked immediately). Returns unsubscribe. */
 onState(cb: (state: VoiceState) => void): () => void;
}

/** Longest prefix ending at a sentence boundary, or '' while none yet. */
const COMPLETE_SENTENCES = /^[\s\S]*[.!?…][”’"')\]]*(?=\s|$)/;

function dispatchKaraoke(detail: KaraokeDetail): void {
 window.dispatchEvent(new CustomEvent<KaraokeDetail>('natally-karaoke', { detail }));
}

export function createVoice(): Voice {
 const listeners = new Set<(state: VoiceState) => void>();
 const state: VoiceState = { admitted: false, speaking: false, error: null };
 const emit = () => {
  const snapshot = { ...state };
  for (const listener of listeners) listener(snapshot);
 };

 let pending = '';
 let queue: string[] = [];
 let fresh = true;
 let epoch = 0;
 let running = false;
 let flushed = false;
 let played = false;
 let failed = false;
 let completion: (() => void) | undefined;
 // First-chunk audio pre-synthesised for the next queued sentence while the
 // current one plays (§8.1 item 4). Always belongs to the current epoch.
 let preparedNext: Promise<LocalSpeech> | null = null;

 const completeIfReady = () => {
  if (!flushed || running || queue.length > 0 || pending.trim() !== '' || !played) return;
  const callback = completion;
  completion = undefined;
  flushed = false;
  callback?.();
 };

 /** The first worker chunk speakNatallyText would split this line into, or
  *  null when prefetching is off or the line has nothing to speak. */
 const firstSpeechChunk = (line: string): Promise<LocalSpeech> | null => {
  const settings = loadVoiceSettings();
  const policy = getSpeechPolicy(settings.resourceMode,
   typeof navigator === 'undefined' ? {} : navigator, undefined);
  if (!policy.prefetch) return null;
  const chunk = splitSpeechText(prepareSpeechWithOffsets(line).text, policy.chunkChars)[0];
  if (!chunk) return null;
  return supertonicSpeak(chunk, { voice: settings.aiVoiceName, speed: settings.rate });
 };

 subscribeVoiceStatus(status => {
  const error = status.phase === 'error' ? status.message ?? 'Voice failed.' : null;
  if (error !== state.error) {
   state.error = error;
   emit();
  }
 });

 const pump = async () => {
  if (running || !state.admitted || queue.length === 0) return;
  running = true;
  const mine = epoch;
  state.speaking = true;
  emit();
  try {
   // §8.1 item 2: if the model is still downloading or preparing, wait for
   // that same load and then speak — a speakStream issued mid-load is
   // never silently dropped. A failed load falls through: speakNatallyText
   // restarts the worker and reports its own retryable error.
   await initSupertonic().catch(() => {});
   if (mine !== epoch) return;
   while (queue.length > 0 && mine === epoch) {
    const line = queue.shift()!;
    const words = [...line.matchAll(/\S+/g)];
    const prepared = preparedNext;
    preparedNext = null;
    // Kick the next sentence's first chunk into the worker before this
    // sentence starts playing (§8.1 item 4); the worker serialises it
    // behind this sentence's own chunks so it is ready at the boundary.
    const upcomingPrepared = mine === epoch && queue[0] ? firstSpeechChunk(queue[0]) : null;
    void upcomingPrepared?.catch(() => {});
    const completed = await speakNatallyText(line, loadVoiceSettings(), undefined, undefined, (charIndex: number) => {
     const wordIndex = Math.max(0, words.findIndex(word => word.index! >= charIndex));
     dispatchKaraoke({ line, wordIndex, wordCount: words.length });
    }, prepared ? { preparedAudio: prepared } : undefined);
    if (mine !== epoch) return;
    if (!completed) {
     completion = undefined;
     flushed = false;
     queue = [];
     pending = '';
     failed = true;
     preparedNext = null;
     return;
    }
    played = true;
    if (upcomingPrepared) preparedNext = upcomingPrepared;
   }
  } catch (cause) {
   if (mine === epoch) {
    completion = undefined;
    flushed = false;
    queue = [];
    pending = '';
    failed = true;
    preparedNext = null;
    state.error = cause instanceof Error ? cause.message : 'Voice playback failed.';
   }
  } finally {
   running = false;
   if (queue.length > 0) void pump();
   else if (mine === epoch) {
    state.speaking = false;
    emit();
    completeIfReady();
   }
  }
 };

 const stop = () => {
  epoch += 1;
  queue = [];
  pending = '';
  fresh = true;
  flushed = false;
  played = false;
  failed = false;
  completion = undefined;
  preparedNext = null;
  stopSpeaking();
  if (state.speaking) {
   state.speaking = false;
   emit();
  }
 };

 return {
  speakStream(text, opts) {
   if (fresh) {
    stop();
    fresh = false;
   }
   if (failed) {
    if (opts?.flush) fresh = true;
    return;
   }
   pending += text;
   const complete = opts?.flush ? pending : (COMPLETE_SENTENCES.exec(pending)?.[0] ?? '');
   pending = pending.slice(complete.length);
   if (complete.trim() !== '') queue.push(complete.trim());
   if (opts?.onComplete) completion = opts.onComplete;
   if (opts?.flush) { fresh = true; flushed = true; }
   void pump();
   completeIfReady();
  },
  stop,
  admit() {
   if (state.admitted) return;
   state.admitted = true;
   // Resume inside the gesture: browsers only unlock audio here.
   void getSharedAudioContext()?.resume();
   void initSupertonic().catch(() => { });
   emit();
   void pump();
  },
  get admitted() {
   return state.admitted;
  },
  onState(cb) {
   listeners.add(cb);
   cb({ ...state });
   return () => listeners.delete(cb);
  },
 };
}
