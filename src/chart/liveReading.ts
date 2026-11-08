// Bespoke click readings: the authored lesson for the clicked body blended
// with the sky of the moment, computed on-device at click time — in
// Natally's SOUL.md voice (Gen-Z lingo, warm overshare; chart facts exact).
// Pure composition; sky positions come from the verbatim ephemeris
// pipeline (src/atelier-original).

import { getLesson } from '../content/lessons';
import type { ChartBodyKey } from '../shared/types';

/** A placed body relevant to the reading: natal or current. */
export interface SkyPlacement {
  sign: string;
  /** Ecliptic longitude in degrees. */
  lon: number;
}

const ASPECTS: readonly { angle: number; link: string; riff: string }[] = [
  {
    angle: 0,
    link: 'is sitting RIGHT on top of',
    riff: "That's live-as-of-today close — the theme is basically unavoidable this week. I would just roll with it, honestly.",
  },
  {
    angle: 60,
    link: 'is sliding an easy little sextile to',
    riff: 'A small door is open this week. Nudge it. Worst case it was already unlocked.',
  },
  {
    angle: 90,
    link: 'is squaring',
    riff: 'Not a verdict, just homework with feelings — something wants building this week. Annoying, growth-y, same thing.',
  },
  {
    angle: 120,
    link: 'is trining',
    riff: 'Free real estate this week — start the thing. The ground is weirdly kind right now.',
  },
  {
    angle: 180,
    link: 'is directly opposite',
    riff: "Across-the-table energy: you, it, one long negotiation. Fascinating though. Don't text it back first.",
  },
];

function separation(a: number, b: number): number {
  const raw = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(raw, 360 - raw);
}

function dominantAspect(a: number, b: number): { angle: number; link: string; riff: string; orb: number } | null {
  const sep = separation(a, b);
  let best: (typeof ASPECTS)[number] | null = null;
  let bestOrb = Number.POSITIVE_INFINITY;
  for (const aspect of ASPECTS) {
    const orb = Math.abs(sep - aspect.angle);
    if (orb < bestOrb) {
      best = aspect;
      bestOrb = orb;
    }
  }
  return best && bestOrb <= 7 ? { ...best, orb: Math.round(bestOrb * 10) / 10 } : null;
}

/**
 * One flowing explanation in her voice: authored lesson, where the body is
 * right now, its live aspect to the natal placement, and the week's riff.
 * `sky: null` degrades truthfully to the authored lesson alone.
 */
export function composeLiveReading(
  planet: ChartBodyKey,
  natal: SkyPlacement,
  sky: SkyPlacement | null,
): string {
  const lesson = getLesson(planet);
  const base = lesson.what.replace(/\s+$/, '');
  if (!sky) return base;
  const aspect = dominantAspect(sky.lon, natal.lon);
  const nowLine = `Okay, live check: ${planet} is cruising through ${sky.sign} right now`;
  if (!aspect) {
    return `${base} ${nowLine}, and it's not really talking to your ${natal.sign} placement — low-key background noise this week, which is fine. Not everything needs a plot.`;
  }
  return `${base} ${nowLine}, and it ${aspect.link} your natal ${planet} in ${natal.sign} — ${aspect.orb}° orb, as of today. ${aspect.riff}`;
}
