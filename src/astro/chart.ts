// Natal chart computation: birth wall-clock → UTC via the IANA zone rules the
// browser's Intl implementation carries (naive time: the offset the birth
// zone observes at that moment, DST included as recorded history — no
// guessing beyond it), Swiss Ephemeris positions, Placidus houses, aspects.

import type {
  Aspect,
  AspectKind,
  BirthInput,
  ChartBody,
  ChartBodyKey,
  EclipticPoint,
  House,
  HouseCusp,
  HouseCuspTable,
  NatalChart,
  ZodiacSign,
} from '../shared/types';
import { SE_BODY, calcUt, julianDay, placidusHouses } from './ephemeris';

/** Moving bodies carried on the wheel, in canonical order. */
const MOVING_BODIES: readonly { key: ChartBodyKey; id: number }[] = [
  { key: 'Sun', id: SE_BODY.SUN },
  { key: 'Moon', id: SE_BODY.MOON },
  { key: 'Mercury', id: SE_BODY.MERCURY },
  { key: 'Venus', id: SE_BODY.VENUS },
  { key: 'Mars', id: SE_BODY.MARS },
  { key: 'Jupiter', id: SE_BODY.JUPITER },
  { key: 'Saturn', id: SE_BODY.SATURN },
  { key: 'Uranus', id: SE_BODY.URANUS },
  { key: 'Neptune', id: SE_BODY.NEPTUNE },
  { key: 'Pluto', id: SE_BODY.PLUTO },
  { key: 'Chiron', id: SE_BODY.CHIRON },
  { key: 'TrueNode', id: SE_BODY.TRUE_NODE },
];

const ZODIAC: readonly ZodiacSign[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const ASPECT_ANGLES: readonly { kind: AspectKind; angle: number }[] = [
  { kind: 'conjunction', angle: 0 },
  { kind: 'sextile', angle: 60 },
  { kind: 'square', angle: 90 },
  { kind: 'trine', angle: 120 },
  { kind: 'opposition', angle: 180 },
];

/** Widest departure from exact still reported as an aspect. */
const MAX_ORB_DEG = 8;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function normalized(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function signOf(longitude: number): ZodiacSign {
  return ZODIAC[Math.floor(normalized(longitude) / 30)];
}

/** House whose cusp the longitude most recently crossed (0° onto a cusp counts as entering that house). */
function houseOf(longitude: number, cusps: readonly number[]): House {
  let best: House = 1;
  let bestBehind = normalized(longitude - cusps[0]);
  for (let h = 2; h <= 12; h++) {
    const behind = normalized(longitude - cusps[h - 1]);
    if (behind < bestBehind) {
      bestBehind = behind;
      best = h as House;
    }
  }
  return best;
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Minutes the zone is east of UTC at the given instant (Vienna in CEST → 120). */
function utcOffsetMinutes(instantMs: number, timeZone: string): number {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instantMs));
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        hour = Number(part.value);
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return Math.round((wallAsUtc - instantMs) / 60_000);
}

/**
 * UTC instant of a naive wall-clock birth moment. The offset is read at the
 * moment itself and refined once: unambiguous times get the exact offset the
 * zone observes; a repeated (fall-back) wall time resolves to its later,
 * post-transition reading; a skipped (spring-forward) wall time resolves
 * through the pre-transition offset. Deterministic, never a guess beyond the
 * recorded zone rules.
 */
function birthInstantUtcMs(dateIso: string, timeIso: string, timeZone: string): number {
  const wallAsUtc = Date.parse(`${dateIso}T${timeIso}:00Z`);
  if (Number.isNaN(wallAsUtc)) {
    throw new TypeError(`BirthInput carries a non-existent calendar date: ${dateIso} ${timeIso}`);
  }
  let offset = utcOffsetMinutes(wallAsUtc, timeZone);
  for (let pass = 0; pass < 2; pass++) {
    const refined = utcOffsetMinutes(wallAsUtc - offset * 60_000, timeZone);
    if (refined === offset) break;
    offset = refined;
  }
  return wallAsUtc - offset * 60_000;
}

/** Aspects among the placed bodies (Ascendant and Midheaven included). */
function aspectsBetween(bodies: readonly ChartBody[]): Aspect[] {
  const aspects: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const separation = normalized(
        Math.abs(bodies[i].position.longitude - bodies[j].position.longitude),
      );
      const sep = separation > 180 ? 360 - separation : separation;
      let best: { kind: AspectKind; orb: number } | null = null;
      for (const { kind, angle } of ASPECT_ANGLES) {
        const orb = Math.abs(sep - angle);
        if (orb <= MAX_ORB_DEG && (!best || orb < best.orb)) {
          best = { kind, orb };
        }
      }
      if (best) {
        aspects.push({ a: bodies[i].key, b: bodies[j].key, kind: best.kind, orb: best.orb });
      }
    }
  }
  return aspects;
}

/**
 * The natal chart for a birth input. With an unknown birth time
 * (`timeIso: null`) the chart is computed for noon of the birth date — the
 * standard convention that keeps sign placements meaningful — and the houses
 * describe that noon moment.
 */
export async function natalChart(input: BirthInput): Promise<NatalChart> {
  if (!DATE_RE.test(input.dateIso)) {
    throw new TypeError(`BirthInput.dateIso must be YYYY-MM-DD, got: ${input.dateIso}`);
  }
  const timeIso = input.timeIso ?? '12:00';
  if (!TIME_RE.test(timeIso)) {
    throw new TypeError(`BirthInput.timeIso must be HH:mm or null, got: ${input.timeIso}`);
  }

  const instantMs = birthInstantUtcMs(input.dateIso, timeIso, input.place.timezoneIana);
  const utc = new Date(instantMs);
  const jdUt = await julianDay(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
    utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600,
  );

  const houses = await placidusHouses(jdUt, input.place.latitude, input.place.longitude);
  const cusps = houses.cusps;

  const bodies: ChartBody[] = [];
  for (const body of MOVING_BODIES) {
    const position = await calcUt(jdUt, body.id);
    bodies.push({
      key: body.key,
      position: {
        longitude: position.longitude,
        latitude: position.latitude,
        speed: position.speedLongitude,
      },
      sign: signOf(position.longitude),
      house: houseOf(position.longitude, cusps),
    });
  }

  // The angles: house positions by definition (Ascendant cusp 1, Midheaven cusp 10).
  const angles: readonly { key: ChartBodyKey; longitude: number }[] = [
    { key: 'Ascendant', longitude: houses.ascendant },
    { key: 'Midheaven', longitude: houses.midheaven },
  ];
  for (const angle of angles) {
    bodies.push({
      key: angle.key,
      position: { longitude: angle.longitude },
      sign: signOf(angle.longitude),
      house: houseOf(angle.longitude, cusps),
    });
  }

  const cuspEntry = (house: number): HouseCusp => ({
    house: house as House,
    position: { longitude: cusps[house - 1] },
  });
  const housesTable: HouseCuspTable = [
    cuspEntry(1),
    cuspEntry(2),
    cuspEntry(3),
    cuspEntry(4),
    cuspEntry(5),
    cuspEntry(6),
    cuspEntry(7),
    cuspEntry(8),
    cuspEntry(9),
    cuspEntry(10),
    cuspEntry(11),
    cuspEntry(12),
  ];

  return {
    input,
    bodies,
    houses: housesTable,
    ascendant: { longitude: houses.ascendant } satisfies EclipticPoint,
    midheaven: { longitude: houses.midheaven } satisfies EclipticPoint,
    aspects: aspectsBetween(bodies),
  };
}
