import gazetteerData from './gazetteer.json';

/**
 * Ported from natally's first-light onboarding (apps/local/src/content).
 * A birthplace must carry an IANA zone — a bare numeric offset cannot encode
 * the historical DST rules a natal chart depends on.
 */
export interface GazetteerEntry {
  readonly id: string;
  readonly name: string;
  readonly countryCode: string;
  readonly lat: number;
  readonly lon: number;
  readonly tzid: string;
}

let cache: readonly GazetteerEntry[] | null = null;

export function loadGazetteer(): readonly GazetteerEntry[] {
  cache ??= Object.freeze(gazetteerData as GazetteerEntry[]);
  return cache;
}

/**
 * Offset (in hours from UTC) the zone was observing at the given wall-clock
 * moment. DST-aware: resolves through Intl's zone rules for the actual birth
 * date, so a July birth in `America/Toronto` yields -4, not -5.
 */
export function tzOffsetHours(tzid: string, date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || !Number.isInteger(hh) || !Number.isInteger(mm)) {
    throw new Error(`Invalid birth moment: ${date} ${time}`);
  }
  // Two refinement passes converge on the correct instant, even when the
  // initial guess lands on the far side of a DST transition.
  let guessUtcMs = Date.UTC(y, m - 1, d, hh, mm);
  let offsetMin = zoneOffsetMinutes(tzid, guessUtcMs);
  for (let i = 0; i < 2; i++) {
    guessUtcMs = Date.UTC(y, m - 1, d, hh, mm) - offsetMin * 60_000;
    offsetMin = zoneOffsetMinutes(tzid, guessUtcMs);
  }
  const hours = offsetMin / 60;
  if (!Number.isFinite(hours)) throw new Error(`Unknown time zone: ${tzid}`);
  return Math.round(hours * 60) / 60; // keep half-hour zones exact
}

function zoneOffsetMinutes(tzid: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tzid,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines render midnight as 24
  const asUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return (asUtcMs - utcMs) / 60_000;
}
