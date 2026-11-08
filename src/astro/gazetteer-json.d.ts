// Ambient declaration for the vendored gazetteer so `src/astro/gazetteer.ts`
// can import the JSON document while `tsc --noEmit` stays the lint gate
// (the project tsconfig does not enable --resolveJsonModule; the W0 shell owns
// that file, so the declaration lives here, inside src/astro).

declare module '*gazetteer.json' {
  /** One GeoNames-derived entry of `src/gazetteer.json`. */
  export interface GazetteerEntry {
    id: string;
    name: string;
    countryCode: string;
    lat: number;
    lon: number;
    tzid: string;
  }

  const entries: readonly GazetteerEntry[];

  export default entries;
}
