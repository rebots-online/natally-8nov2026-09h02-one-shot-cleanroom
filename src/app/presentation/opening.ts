// The opening reading (DOCS/ARCHITECTURE.md §First reveal and speech-driven
// presentation): the stage opens with Natally reading the chart aloud at
// once, as her first chat message. Composed from the real chart with the
// same presentation cues her streamed replies carry, so the wheel and her
// narration move together from the very first moment.

import type { NatalChart } from '../../shared/types';

/** Her first chat message: the chart read aloud, cue by cue. */
export function openingReading(chart: NatalChart): string {
  const name = chart.input.name ? `${chart.input.name}, ` : '';
  return `[[view:chart]]Okay, ${name}there's your wheel! A natal chart maps the sky at birth: bodies carry the themes, signs give them a style, houses locate life areas, and the lines show their relationships. ${chart.input.timeIso === null ? "We don't have a reliable birth time, so I'll leave the houses and rising angle out rather than make them up. " : ''}[[chart:clear]][[view:atelier]]I'll walk you through the whole thing, one piece at a time. Low-key excited. General meanings first, then the personal connections when your reading access is ready. You can pause me or jump in whenever you like.`;
}
