// Glue between the clean-room chart pipeline (src/astro, src/shared) and the
// verbatim original renderer (src/atelier-original): the original
// Astrolabe3D consumes NatalChartInput/NatalChartResult from its own
// ephemeris module, so birth data is adapted here and the result is computed
// by the original's calculateNatalChart — the renderer sees exactly the
// pipeline it was built against.

import type { BirthInput } from '../shared/types';
import type { NatalChartInput } from '../atelier-original/services/ephemeris';
import { calculateNatalChart } from '../atelier-original/services/ephemeris';
import type { NatalChartResult } from '../atelier-original/services/ephemeris';

/** UTC offset in hours for a local wall-clock moment in an IANA zone. */
function timezoneOffsetHours(dateIso: string, timeIso: string, timeZone: string): number {
  const [year, month, day] = dateIso.split('-').map(Number);
  const [hour, minute] = timeIso.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess));
  const field = (name: string) => Number(parts.find(part => part.type === name)?.value ?? '0');
  const asUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour') % 24,
    field('minute'),
  );
  return (asUtc - guess) / 3_600_000;
}

/** BirthInput → the original renderer's input contract. */
export function toAstrolabeInput(birth: BirthInput): NatalChartInput {
  const timeIso = birth.timeIso ?? '12:00';
  return {
    name: birth.name ?? '',
    birthDate: birth.dateIso,
    birthTime: timeIso,
    birthTimeUnknown: birth.timeIso === null,
    placeName: birth.place.label,
    latitude: birth.place.latitude,
    longitude: birth.place.longitude,
    timezoneOffset: timezoneOffsetHours(birth.dateIso, timeIso, birth.place.timezoneIana),
    houseSystem: 'P',
  };
}

/** Compute the wheel with the original renderer's own pipeline. */
export function computeAstrolabeChart(birth: BirthInput): Promise<NatalChartResult> {
  return calculateNatalChart(toAstrolabeInput(birth));
}

export type { NatalChartResult };
