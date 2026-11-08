// Frozen domain types shared across the Natally clean-room client.
// Contracts here are the authority; consumers must not fork these shapes.

/** The twelve tropical signs, in zodiacal order. */
export type ZodiacSign =
  | 'Aries'
  | 'Taurus'
  | 'Gemini'
  | 'Cancer'
  | 'Leo'
  | 'Virgo'
  | 'Libra'
  | 'Scorpio'
  | 'Sagittarius'
  | 'Capricorn'
  | 'Aquarius'
  | 'Pisces';

/** Bodies and sensitive points a natal chart can carry. */
export type ChartBodyKey =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'
  | 'Chiron'
  | 'TrueNode'
  | 'Ascendant'
  | 'Midheaven';

/** House numbers 1 through 12. */
export type House = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type AspectKind =
  | 'conjunction'
  | 'opposition'
  | 'square'
  | 'trine'
  | 'sextile';

/** A birth place resolved to coordinates and an IANA timezone. */
export interface GeoPlace {
  label: string;
  latitude: number;
  longitude: number;
  timezoneIana: string;
}

/** Birth data a natal chart is computed from. */
export interface BirthInput {
  name?: string;
  /** Calendar date, `YYYY-MM-DD`. */
  dateIso: string;
  /** Local clock time `HH:mm`, or null when the birth time is unknown. */
  timeIso: string | null;
  place: GeoPlace;
}

/** A point on the ecliptic, tropical zodiac. */
export interface EclipticPoint {
  /** Longitude in degrees, 0–360 measured from 0° Aries. */
  longitude: number;
  /** Latitude in degrees off the ecliptic, when meaningful. */
  latitude?: number;
  /** Daily motion in degrees/day, when meaningful. */
  speed?: number;
}

/** A chart body placed on the zodiac and in a house. */
export interface ChartBody {
  key: ChartBodyKey;
  position: EclipticPoint;
  sign: ZodiacSign;
  house: House;
}

/** The cusp of one house. */
export interface HouseCusp {
  house: House;
  position: EclipticPoint;
}

/** Exactly twelve cusps, house 1 through house 12, in order. */
export type HouseCuspTable = [
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
  HouseCusp,
];

/** An aspect between two chart bodies. */
export interface Aspect {
  a: ChartBody['key'];
  b: ChartBody['key'];
  kind: AspectKind;
  /** Departure from exact, in degrees. */
  orb: number;
}

/** A computed natal chart with its input echoed back. */
export interface NatalChart {
  input: BirthInput;
  bodies: ChartBody[];
  houses: HouseCuspTable;
  ascendant: EclipticPoint;
  midheaven: EclipticPoint;
  aspects: Aspect[];
}

/** One turn in a conversation with Natally. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'natally';
  text: string;
  /** Epoch milliseconds. */
  at: number;
}

/** What a purchase buys. */
export type PurchaseKind = 'credits' | 'souvenir';

/**
 * Server-signed view of the customer's conversation allowance.
 * `state: 'none'` means no allowance is available; `allowanceUsdMicros` is
 * grants minus posted usage in integer USD micros.
 */
export interface AllowanceEnvelope {
  state: 'none' | 'ready';
  allowanceUsdMicros: number;
  postedUsageUsdMicros: number;
  /** Present only with ready managed access. */
  key?: {
    maskedKey: string;
    limitUsdMicros: number;
  };
}

/** A durable grant of allowance from a payment or a redemption. */
export interface GrantRecord {
  id: string;
  kind: PurchaseKind;
  amountUsdMicros: number;
  /** Epoch milliseconds. */
  at: number;
  source: 'chargebee' | 'redemption';
}
