// Swiss Ephemeris (2.10.03) WASM wrapper.
//
// The engine is the emscripten build vendored at `public/vendor/swisseph/`
// (`swisseph.js` loader + `swisseph.wasm` + `swisseph.data`). The `.data`
// bundle unpacks the ephemeris files (semo_18.se1, sepl_18.se1, seas_18.se1,
// …) into the `/sweph` directory of the loader's in-memory filesystem, so
// `swe_set_ephe_path("/sweph")` is required before `swe_calc_ut` will use the
// true Swiss Ephemeris files instead of silently falling back to the Moshier
// approximation. The loader API was verified against the vendored build:
// it default-exports an async `Swisseph(moduleArg)` factory accepting
// `locateFile`, and the resolved module exposes the raw `_swe_*` exports
// plus `_malloc`/`_free`, `UTF8ToString`, `stringToUTF8` and `HEAPF64`.

const SWISSEPH_DIR = '/vendor/swisseph';
const SWISSEPH_EPHE_PATH = '/sweph';

interface SwissephModule {
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  _swe_set_ephe_path(pathPtr: number): void;
  _swe_julday(
    year: number,
    month: number,
    day: number,
    hourUt: number,
    gregFlag: number,
  ): number;
  _swe_calc_ut(
    jdUt: number,
    body: number,
    iflag: number,
    xxPtr: number,
    serrPtr: number,
  ): number;
  _swe_houses(
    jdUt: number,
    latitude: number,
    longitude: number,
    hsys: number,
    cuspsPtr: number,
    ascmcPtr: number,
  ): number;
  UTF8ToString(ptr: number): string;
  stringToUTF8(text: string, outPtr: number, maxBytes: number): void;
  HEAPF64: Float64Array;
}

type SwissephFactory = (moduleArg: {
  locateFile?: (path: string, scriptDirectory: string) => string;
}) => Promise<SwissephModule>;

/** Swiss Ephemeris body ids in main-body numbering. */
export const SE_BODY = {
  SUN: 0,
  MOON: 1,
  MERCURY: 2,
  VENUS: 3,
  MARS: 4,
  JUPITER: 5,
  SATURN: 6,
  URANUS: 7,
  NEPTUNE: 8,
  PLUTO: 9,
  TRUE_NODE: 11,
  // Chiron as a main body (SE_CHIRON). The SE_ASTOID + asteroid-number path
  // would need per-asteroid .se1 files that are not vendored; body 15 resolves
  // through the bundled seas_18.se1.
  CHIRON: 15,
} as const;

const SE_GREG_CAL = 1;
const SEFLG_SWIEPH = 2;
const SEFLG_SPEED = 128;
const PLACIDUS_HSYS = 80; // 'P'
const SERR_BYTES = 256;

let modulePromise: Promise<SwissephModule> | null = null;

async function loadModule(): Promise<SwissephModule> {
  // Dynamic import is required: the loader is a public/ asset served from the
  // site origin, not a module Vite can resolve statically or bundle. A static
  // import of "/vendor/..." would fail the Vite build; @vite-ignore keeps the
  // specifier runtime-resolved against the served origin (dev and dist).
  const loader = (await import(/* @vite-ignore */ `${SWISSEPH_DIR}/swisseph.js`)) as {
    default: SwissephFactory;
  };
  const module = await loader.default({
    locateFile: (path) => `${SWISSEPH_DIR}/${path}`,
  });
  const pathPtr = module._malloc(SWISSEPH_EPHE_PATH.length + 1);
  try {
    module.stringToUTF8(
      SWISSEPH_EPHE_PATH,
      pathPtr,
      SWISSEPH_EPHE_PATH.length + 1,
    );
    module._swe_set_ephe_path(pathPtr);
  } finally {
    module._free(pathPtr);
  }
  return module;
}

function ephemerisModule(): Promise<SwissephModule> {
  modulePromise ??= loadModule();
  return modulePromise;
}

function readDoubles(module: SwissephModule, ptr: number, count: number): number[] {
  const base = ptr / 8;
  return Array.from(module.HEAPF64.subarray(base, base + count));
}

/** Ecliptic-of-date position with daily rates, tropical, apparent geocentric. */
export interface EphemerisPosition {
  longitude: number;
  latitude: number;
  distance: number;
  speedLongitude: number;
  speedLatitude: number;
  speedDistance: number;
}

/**
 * Julian day (UT) for a proleptic-Gregorian calendar date. `hourUt` carries
 * minutes and seconds as a fraction.
 */
export async function julianDay(
  year: number,
  month: number,
  day: number,
  hourUt: number,
): Promise<number> {
  const module = await ephemerisModule();
  return module._swe_julday(year, month, day, hourUt, SE_GREG_CAL);
}

/**
 * `swe_calc_ut` for one body. Throws when the engine reports an error and
 * when the true Swiss Ephemeris files were not used (missing /sweph bundle
 * would otherwise degrade silently to the Moshier fallback).
 */
export async function calcUt(
  jdUt: number,
  body: number,
  iflag: number = SEFLG_SWIEPH | SEFLG_SPEED,
): Promise<EphemerisPosition> {
  const module = await ephemerisModule();
  const xxPtr = module._malloc(6 * 8);
  const serrPtr = module._malloc(SERR_BYTES);
  try {
    const ret = module._swe_calc_ut(jdUt, body, iflag, xxPtr, serrPtr);
    if (ret < 0) {
      throw new Error(
        `Swiss Ephemeris failed for body ${body}: ${module.UTF8ToString(serrPtr)}`,
      );
    }
    if ((ret & SEFLG_SWIEPH) === 0) {
      throw new Error(
        `Swiss Ephemeris data files unavailable for body ${body} (expected /sweph/*.se1)`,
      );
    }
    const [longitude, latitude, distance, speedLongitude, speedLatitude, speedDistance] =
      readDoubles(module, xxPtr, 6);
    return {
      longitude,
      latitude,
      distance,
      speedLongitude,
      speedLatitude,
      speedDistance,
    };
  } finally {
    module._free(xxPtr);
    module._free(serrPtr);
  }
}

/** Placidus house cusps plus Ascendant/Midheaven for a birth moment/place. */
export interface HouseCusps {
  /** Twelve longitudes, house 1 through house 12 in order. */
  cusps: readonly number[];
  ascendant: number;
  midheaven: number;
}

/**
 * `swe_houses` with the 'P' (Placidus) system. `swe_houses` has no error-string
 * parameter; a negative return means the system is undefined there (polar
 * latitudes).
 */
export async function placidusHouses(
  jdUt: number,
  latitude: number,
  longitude: number,
): Promise<HouseCusps> {
  const module = await ephemerisModule();
  const cuspsPtr = module._malloc(13 * 8); // index 0 unused by the C API
  const ascmcPtr = module._malloc(10 * 8);
  try {
    const ret = module._swe_houses(jdUt, latitude, longitude, PLACIDUS_HSYS, cuspsPtr, ascmcPtr);
    if (ret < 0) {
      throw new Error(
        `Swiss Ephemeris Placidus houses failed at latitude ${latitude} (undefined at polar latitudes)`,
      );
    }
    const raw = readDoubles(module, cuspsPtr, 13);
    const ascmc = readDoubles(module, ascmcPtr, 10);
    return {
      cusps: raw.slice(1),
      ascendant: ascmc[0],
      midheaven: ascmc[1],
    };
  } finally {
    module._free(cuspsPtr);
    module._free(ascmcPtr);
  }
}
