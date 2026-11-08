// Natally's voice for the app surface: one engine, the original's.
// The original voiceService (F4 speaker, pitch 1.15, soft tone, kawaii
// preset) synthesizes and plays every utterance, and emits the real
// per-word `natally-voice-performance` events — timed from the actual audio
// duration — that drive the verbatim AtelierCharacter's mouth. This module
// only adapts that engine to the streaming `Voice` interface the app uses
// (token fragments in, sentences out, gesture-gated admission) and mirrors
// word boundaries into `natally-karaoke` caption events.

import { initSupertonic, subscribeVoiceStatus } from '../atelier-original/services/supertonicTts';
import {
 getSharedAudioContext,
 loadVoiceSettings,
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
   while (queue.length > 0 && mine === epoch) {
    const line = queue.shift()!;
    const words = [...line.matchAll(/\S+/g)];
    await speakNatallyText(line, loadVoiceSettings(), undefined, undefined, (charIndex: number) => {
     const wordIndex = Math.max(0, words.findIndex(word => word.index! >= charIndex));
     dispatchKaraoke({ line, wordIndex, wordCount: words.length });
    });
   }
  } finally {
   running = false;
   if (queue.length > 0) void pump();
   else if (mine === epoch) {
    state.speaking = false;
    emit();
   }
  }
 };

 const stop = () => {
  epoch += 1;
  queue = [];
  pending = '';
  fresh = true;
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
   pending += text;
   const complete = opts?.flush ? pending : (COMPLETE_SENTENCES.exec(pending)?.[0] ?? '');
   pending = pending.slice(complete.length);
   if (complete.trim() !== '') queue.push(complete.trim());
   if (opts?.flush) fresh = true;
   void pump();
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
