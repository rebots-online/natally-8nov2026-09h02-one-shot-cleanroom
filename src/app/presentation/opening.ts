// The opening reading (DOCS/ARCHITECTURE.md §First reveal and speech-driven
// presentation): the stage opens with Natally reading the chart aloud at
// once, as her first chat message. Composed from the real chart with the
// same presentation cues her streamed replies carry, so the wheel and her
// narration move together from the very first moment.

import type { NatalChart } from '../../shared/types';

/** Her first chat message: the chart read aloud, cue by cue. */
export function openingReading(chart: NatalChart): string {
  const name = chart.input.name ? `${chart.input.name}, ` : '';
  const sun = chart.bodies.find(body => body.key === 'Sun');
  const moon = chart.bodies.find(body => body.key === 'Moon');
  const ascendant = chart.bodies.find(body => body.key === 'Ascendant');
  const timed = chart.input.timeIso !== null;

  const lines: string[] = [];
  lines.push(
    `[[view:chart]]There it is, ${name}your wheel — I cast it the moment you sat down, and it's a good one.`,
  );

  const inHouse = (house: number) => (timed ? ` in the ${ordinal(house)} house` : '');
  if (sun !== undefined && moon !== undefined) {
    lines.push(
      `[[chart:Sun;Moon]]Your Sun in ${sun.sign}${inHouse(sun.house)} and your Moon in ${moon.sign}${inHouse(moon.house)} set the tone for everything else I'll show you.`,
    );
  } else if (sun !== undefined) {
    lines.push(
      `[[chart:Sun]]Your Sun in ${sun.sign}${inHouse(sun.house)} is the hearth of this wheel — we'll light everything else from it.`,
    );
  }
  if (ascendant !== undefined) {
    lines.push(
      `[[chart:Ascendant]]You meet the world through ${ascendant.sign} rising, so every first impression you make carries that signature.`,
    );
  }

  const trine = chart.aspects.find(aspect => aspect.kind === 'trine');
  if (trine !== undefined) {
    lines.push(
      `[[chart:${trine.a};${trine.b}]]And here — ${trine.a} and ${trine.b} in trine. That's real music; those two spend your whole life helping each other.`,
    );
  }

  lines.push(
    '[[chart:clear]][[view:atelier]]Sit with me and ask anything — the wheel is ours now.',
  );
  return lines.join(' ');
}

const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
] as const;

function ordinal(house: number): string {
  return ORDINALS[house - 1] ?? String(house);
}
