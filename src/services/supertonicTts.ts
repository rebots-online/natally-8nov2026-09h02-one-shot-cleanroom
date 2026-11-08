// Supertonic voice preload for the first-light onboarding
// (src/onboarding-original). The untouched components call
// `scheduleSupertonicPreload()` on mount; in this repo the streaming-TTS
// engine is src/voice, so "preload" truthfully means: construct the one
// shared voice controller early (its worker spins up while the customer
// reads the first prompt) and hand the same instance to whoever speaks.
// Audio itself stays gesture-gated inside the engine — nothing plays until
// `admit()` runs in a real user-gesture handler.

import { createVoice, type Voice } from '../voice';

let preloaded: Voice | null = null;

/** The shared voice controller, created on first call (idempotent). */
export function getPreloadedVoice(): Voice {
  preloaded ??= createVoice();
  return preloaded;
}

/** Warm the streaming-TTS worker early; safe to call from an effect. */
export function scheduleSupertonicPreload(): void {
  getPreloadedVoice();
}
