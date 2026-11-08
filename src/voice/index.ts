/**
 * Public voice API for the Natally app surface (DOCS/ARCHITECTURE.md —
 * "chat with Natally (persona: warm astrologer, streaming, optional voice)").
 *
 * `createVoice()` returns the app-facing controller around the streaming
 * speech engine (`./speech.ts`). Audio is gesture-gated: call `admit()` from
 * a real user-gesture handler (e.g. an "unmute" click) before expecting any
 * sound. Until then `speakStream` buffers the streamed answer and reports the
 * truthful `'voice not admitted'` error (`VOICE_NOT_ADMITTED`) via `onState`.
 */

import { createSpeechEngine } from './speech';
import type { SpeakOptions, VoiceState } from './speech';

export {
  VOICE_NOT_ADMITTED,
  SUPERTONIC_VOICES,
  VOICE_CANDIDATES,
  DEFAULT_VOICE,
} from './speech';
export type { SpeakOptions, SupertonicVoice, VoiceState } from './speech';

export interface Voice {
  /**
   * Feed streamed answer text; token fragments are fine and may be called
   * many times per answer. Sentences are cut at boundaries, synthesized in
   * order by the worker, and played back paced by sentence. Pass
   * `{ flush: true }` with the final fragment to voice trailing text that
   * lacks closing punctuation.
   */
  speakStream(text: string, opts?: SpeakOptions): void;
  /**
   * Stop all queued, synthesizing, and playing speech immediately. The
   * interrupted answer's buffered remainder is discarded.
   */
  stop(): void;
  /**
   * Mark the user-gesture admission for audio. Call inside a click or key
   * handler; only then is an AudioContext created, and any text buffered
   * before admission starts speaking.
   */
  admit(): void;
  /** Whether audio has been admitted by a user gesture. */
  readonly admitted: boolean;
  /**
   * Subscribe to state changes (also invoked immediately with the current
   * state). Returns the unsubscribe function.
   */
  onState(cb: (state: VoiceState) => void): () => void;
}

export function createVoice(): Voice {
  const engine = createSpeechEngine();
  return {
    // Engine functions are plain closures over its state: safe to expose
    // directly, no binding wrappers needed.
    speakStream: engine.speakStream,
    stop: engine.stop,
    admit: engine.admit,
    get admitted() {
      return engine.admitted;
    },
    onState: engine.onState,
  };
}
