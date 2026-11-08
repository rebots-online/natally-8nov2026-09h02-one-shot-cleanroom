// Gazetteer service for the first-light onboarding intake
// (src/onboarding-original). The untouched components expect the original
// `loadGazetteer()` contract over entries carrying GeoNames ids; this repo
// already vendor the identical document at src/gazetteer.json, so the service
// is a thin typed re-export of that single source of truth.

import gazetteerData from '../gazetteer.json';

/**
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
