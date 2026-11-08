// Voice preload seam for the first-light onboarding (src/onboarding-original
// calls `scheduleSupertonicPreload()` on mount). The app speaks through one
// engine — the original Supertonic voice (src/voice adapts it) — so preload
// means: create the one shared controller and start the model worker while
// the customer reads the first prompt. Audio itself stays gesture-gated:
// nothing plays until `admit()` runs inside a real user gesture.

import { initSupertonic } from '../atelier-original/services/supertonicTts';
import { createVoice, type Voice } from '../voice';

let preloaded: Voice | null = null;

/** The shared voice controller, created on first call (idempotent). */
export function getPreloadedVoice(): Voice {
  preloaded ??= createVoice();
  return preloaded;
}

/** Warm the voice model early; safe to call from an effect. */
export function scheduleSupertonicPreload(): void {
  getPreloadedVoice();
  void initSupertonic().catch(() => { });
}
