/** One decorative-motion policy; voice playback is deliberately independent. */
export function canAnimateAtelier(input: { paused: boolean; reducedMotion: boolean; documentVisible: boolean; sceneVisible: boolean }): boolean {
  return !input.paused && !input.reducedMotion && input.documentVisible && input.sceneVisible;
}
