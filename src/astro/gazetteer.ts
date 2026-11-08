// Gazetteer lookup over the vendored `src/gazetteer.json` (108 GeoNames
// places). Pure, synchronous, offline: the JSON is bundled at build time.

import gazetteerEntries from '../gazetteer.json';
import type { GeoPlace } from '../shared/types';

/** Case- and diacritic-insensitive comparison key ("Zürich" → "zurich"). */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface IndexedPlace {
  name: string;
  nameFolded: string;
  labelFolded: string;
  /** `Vienna, AT` — the gazetteer carries codes, not country names. */
  place: GeoPlace;
}

// Deterministic base order: plain ascending by name.
const INDEX: readonly IndexedPlace[] = gazetteerEntries
  .map((entry) => {
    const label = `${entry.name}, ${entry.countryCode}`;
    return {
      name: entry.name,
      nameFolded: fold(entry.name),
      labelFolded: fold(label),
      place: { label, latitude: entry.lat, longitude: entry.lon, timezoneIana: entry.tzid },
    };
  })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

/** 0 = exact, 1 = prefix, 2 = substring; null = no match. */
function matchRank(nameFolded: string, labelFolded: string, query: string): number | null {
  if (nameFolded === query || labelFolded === query) return 0;
  if (nameFolded.startsWith(query) || labelFolded.startsWith(query)) return 1;
  if (nameFolded.includes(query) || labelFolded.includes(query)) return 2;
  return null;
}

/** Places whose name or label matches the query, best matches first. */
export function searchPlace(query: string): GeoPlace[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { rank: number; name: string; place: GeoPlace }[] = [];
  for (const item of INDEX) {
    const rank = matchRank(item.nameFolded, item.labelFolded, q);
    if (rank !== null) scored.push({ rank, name: item.name, place: item.place });
  }
  scored.sort((a, b) => a.rank - b.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return scored.map((s) => s.place);
}

/**
 * The single best place for a query: an exact name/label match, otherwise a
 * query that matches exactly one place (unique prefix included). Returns null
 * when nothing matches or the query is ambiguous.
 */
export function resolvePlace(query: string): GeoPlace | null {
  const q = fold(query.trim());
  if (!q) return null;
  const exact = INDEX.find((i) => i.nameFolded === q || i.labelFolded === q);
  if (exact) return exact.place;
  const matches = searchPlace(query);
  return matches.length === 1 ? matches[0] : null;
}
