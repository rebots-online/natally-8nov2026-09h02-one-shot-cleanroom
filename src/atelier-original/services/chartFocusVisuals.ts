/** Tunable art direction, not an empirical timing or golden-ratio claim. */
export const CHART_FOCUS = { dim: 0.19, steadyHalo: 0.64, peakHalo: 0.94, pulseMs: 720, pulses: 2 } as const;
export function chartHaloOpacity(elapsedMs: number, reducedMotion: boolean): number {
  const duration = CHART_FOCUS.pulseMs * CHART_FOCUS.pulses;
  if (reducedMotion || elapsedMs >= duration) return CHART_FOCUS.steadyHalo;
  const wave = (1 - Math.cos(Math.max(0, elapsedMs) * 2 * Math.PI / CHART_FOCUS.pulseMs)) / 2;
  return CHART_FOCUS.steadyHalo + (CHART_FOCUS.peakHalo - CHART_FOCUS.steadyHalo) * wave;
}
