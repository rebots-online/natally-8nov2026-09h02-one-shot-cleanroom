import type { ReadingStyle } from './readingStyle';
// @ts-ignore - Import vendored Swiss Ephemeris WASM engine directly from our vendored source
import SwissEph from '../vendor/swisseph/src/swisseph.js';

export interface ZodiacSignInfo {
  name: string;
  short: string;
  glyph: string;
  lon: number;
  desc: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
}

export const ZODIAC_SIGNS: ZodiacSignInfo[] = [
  { name: 'Aries', short: 'Ari', glyph: '♈', lon: 0, element: 'Fire', modality: 'Cardinal', desc: 'Cardinal Fire · Initiating vitality & courage' },
  { name: 'Taurus', short: 'Tau', glyph: '♉', lon: 30, element: 'Earth', modality: 'Fixed', desc: 'Fixed Earth · Embodiment, grounding & resource' },
  { name: 'Gemini', short: 'Gem', glyph: '♊', lon: 60, element: 'Air', modality: 'Mutable', desc: 'Mutable Air · Perception, dualities & synthesis' },
  { name: 'Cancer', short: 'Can', glyph: '♋', lon: 90, element: 'Water', modality: 'Cardinal', desc: 'Cardinal Water · Emotional memory & sanctuary' },
  { name: 'Leo', short: 'Leo', glyph: '♌', lon: 120, element: 'Fire', modality: 'Fixed', desc: 'Fixed Fire · Sovereign radiance & creative will' },
  { name: 'Virgo', short: 'Vir', glyph: '♍', lon: 150, element: 'Earth', modality: 'Mutable', desc: 'Mutable Earth · Discernment, craft & calibration' },
  { name: 'Libra', short: 'Lib', glyph: '♎', lon: 180, element: 'Air', modality: 'Cardinal', desc: 'Cardinal Air · Relational balance, harmony & justice' },
  { name: 'Scorpio', short: 'Sco', glyph: '♏', lon: 210, element: 'Water', modality: 'Fixed', desc: 'Fixed Water · Depth psychology, power & metamorphosis' },
  { name: 'Sagittarius', short: 'Sag', glyph: '♐', lon: 240, element: 'Fire', modality: 'Mutable', desc: 'Mutable Fire · Questing faith, philosophy & horizon' },
  { name: 'Capricorn', short: 'Cap', glyph: '♑', lon: 270, element: 'Earth', modality: 'Cardinal', desc: 'Cardinal Earth · Endurance, legacy & crystallization' },
  { name: 'Aquarius', short: 'Aqu', glyph: '♒', lon: 300, element: 'Air', modality: 'Fixed', desc: 'Fixed Air · Visionary collective consciousness' },
  { name: 'Pisces', short: 'Pis', glyph: '♓', lon: 330, element: 'Water', modality: 'Mutable', desc: 'Mutable Water · Oceanic dissolution & transcendence' },
];

export interface HouseCuspData {
  num: number;
  lon: number;
  label: string;
  isCardo: boolean;
  title: string;
  desc: string;
  signName: string;
  signGlyph: string;
  formattedDeg: string;
}

export interface NatalBodyData {
  id: string;
  name: string;
  glyph: string;
  lon: number;
  lat: number;
  speed: number;
  isRetrograde: boolean;
  signName: string;
  signShort: string;
  signGlyph: string;
  degInSign: number;
  minInSign: number;
  secInSign: number;
  degText: string; // e.g., "6° Lib"
  fullDegText: string; // e.g., "06° 43' Libra"
  house: number;
  color: string;
  tier: number;
  clusterAngle: number;
  detail: string;
}

export interface AspectChordData {
  from: string;
  to: string;
  fromGlyph: string;
  toGlyph: string;
  type: 'Opposition' | 'Square' | 'Trine' | 'Sextile' | 'Conjunction';
  symbol: string;
  angle: number;
  orb: number;
  color: number;
  colorHex: string;
  name: string;
  detail: string;
}

export interface NatalChartInput {
  readingStyle?: ReadingStyle;
  name: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:MM
  placeName: string;
  latitude: number;
  longitude: number;
  timezoneOffset: number; // hours from UTC, e.g. -4 for EDT
  houseSystem?: 'P' | 'W' | 'K' | 'E' | 'R'; // P = Placidus, W = Whole Sign, K = Koch, E = Equal, R = Regiomontanus
  currentLocationName?: string;
  currentLatitude?: number;
  currentLongitude?: number;
  currentTimezoneOffset?: number;
  currentTimezoneId?: string;
  birthTimeUnknown?: boolean;
}

export interface CurrentSkySnapshot {
  observedAt: string;
  observationContext?: { locationName?: string; latitude?: number; longitude?: number; timezoneId: string };
  bodies: Array<{ name: string; target: string; glyph: string; lon: number; speed: number; fullDegText: string }>;
  aspects: Array<{ name: string; from: string; to: string; type: AspectChordData['type']; symbol: string; angle: number; orb: number; color: number; colorHex: string; detail: string }>;
}

export interface NatalChartResult {
  input: NatalChartInput;
  julianDayUT: number;
  siderealTimeHours: number;
  ascLon: number;
  mcLon: number;
  dscLon: number;
  icLon: number;
  ascFormatted: string;
  mcFormatted: string;
  sunFormatted: string;
  moonFormatted: string;
  houseCusps: HouseCuspData[];
  natalBodies: NatalBodyData[];
  aspectChords: AspectChordData[];
  engineVersion: string;
  currentSky?: CurrentSkySnapshot;
}

const HOUSE_MEANINGS: Record<number, { name: string; domain: string }> = {
  1: { name: 'Ascendant (AC)', domain: 'The persona, physical vessel, outward demeanor, and interface with reality.' },
  2: { name: 'Substance & Worth', domain: 'Personal resources, self-worth, tangible assets, and inner valuations.' },
  3: { name: 'Mind & Kin', domain: 'Mental frameworks, immediate locality, siblings, communication, and craft.' },
  4: { name: 'Imum Coeli (IC)', domain: 'Ancestral roots, the private midnight sanctum, foundations, and psychological origins.' },
  5: { name: 'Joy & Creation', domain: 'Creative fertility, Eros, play, romance, children, and spontaneous joy.' },
  6: { name: 'Devotion & Craft', domain: 'Daily rhythms, somatic health, systemic service, somatic refinement, and labor.' },
  7: { name: 'Descendant (DC)', domain: 'Significant others, contractual mirrors, intimate partnership, and sacred opposition.' },
  8: { name: 'Shared Depths', domain: 'Intimacy, shared psychological depths, taboos, inheritance, and rebirth.' },
  9: { name: 'Horizons & Truth', domain: 'Philosophy, higher pilgrimage, cosmology, legal frameworks, and expanded frontiers.' },
  10: { name: 'Midheaven (MC)', domain: 'Public legacy, zenith of calling, vocation, reputation, and worldly summit.' },
  11: { name: 'Collective Hopes', domain: 'Fellow pilgrims, collective ideals, long-term visions, assemblies, and benefactors.' },
  12: { name: 'Unseen Sanctuary', domain: 'The collective unconscious, solitude, hidden sanctuary, karmic release, and dreams.' },
};

const PLANET_ARCHETYPES: Record<string, string> = {
  Sun: 'Core vital essence, illuminated awareness, and sovereign life purpose.',
  Moon: 'Instinctual emotional core, somatic memory, and inner sanctuary.',
  Mercury: 'Analytical intellect, cognitive synthesis, and articulate discernment.',
  Venus: 'Relational magnetism, aesthetic harmony, and passionate devotion.',
  Mars: 'Directed willpower, vital drive, courage, and decisive action.',
  Jupiter: 'Generous benevolence, philosophical expansion, and higher synthesis.',
  Saturn: 'Master of time, architectural discipline, endurance, and karmic structure.',
  Uranus: 'Structural awakening, visionary breakthrough, and liberating insight.',
  Neptune: 'Spiritual aspiration, poetic imagination, and oceanic transcendence.',
  Pluto: 'Evolutionary catalyst, volcanic psychological depth, and metamorphosis.',
  Chiron: 'The wounded healer, sacred vulnerability, and integrated wisdom.',
  TrueNode: 'North Node evolutionary destiny toward growth and future integration.',
};

export function formatLongitude(lon: number): {
  sign: ZodiacSignInfo;
  deg: number;
  min: number;
  sec: number;
  shortText: string;
  fullText: string;
  badgeText: string;
} {
  const norm = ((lon % 360) + 360) % 360;
  const signIdx = Math.floor(norm / 30);
  const sign = ZODIAC_SIGNS[signIdx];
  const degFloat = norm - signIdx * 30;
  let deg = Math.floor(degFloat);
  const minFloat = (degFloat - deg) * 60;
  let min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60);

  if (min >= 60) {
    min -= 60;
    deg += 1;
  }

  const degPad = deg.toString().padStart(2, '0');
  const minPad = min.toString().padStart(2, '0');

  return {
    sign,
    deg,
    min,
    sec,
    shortText: `${deg}° ${sign.short}`,
    fullText: `${degPad}° ${minPad}' ${sign.name}`,
    badgeText: `${degPad}°${minPad}' ${sign.name} (${sign.glyph})`,
  };
}

function getHouseForLongitude(lon: number, cusps: number[]): number {
  const normLon = ((lon % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const c1 = cusps[i];
    const c2 = cusps[(i + 1) % 12];
    if (c1 <= c2) {
      if (normLon >= c1 && normLon < c2) return i + 1;
    } else {
      // Wraps around 360 -> 0
      if (normLon >= c1 || normLon < c2) return i + 1;
    }
  }
  return 1;
}

let sharedSweInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function getSwissEph(): Promise<any> {
  if (sharedSweInstance) return sharedSweInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const swe = new SwissEph();
    await swe.initSwissEph();
    sharedSweInstance = swe;
    return swe;
  })();

  return initPromise;
}

export async function calculateNatalChart(input: NatalChartInput): Promise<NatalChartResult> {
  const swe = await getSwissEph();

  const [yearStr, monthStr, dayStr] = input.birthDate.split('-');
  const [hourStr, minStr] = input.birthTime.split(':');

  const year = parseInt(yearStr, 10) || 1989;
  const month = parseInt(monthStr, 10) || 9;
  const day = parseInt(dayStr, 10) || 29;
  const hour = Number.isFinite(Number(hourStr)) ? Number(hourStr) : 17;
  const minute = parseInt(minStr || '0', 10) || 0;

  // Convert local birth time + timezoneOffset to UTC
  const localDecimalHours = hour + minute / 60;
  const utcDecimalHours = localDecimalHours - input.timezoneOffset;

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - Math.round(input.timezoneOffset * 3600 * 1000));
  const uYear = utcDate.getUTCFullYear();
  const uMonth = utcDate.getUTCMonth() + 1;
  const uDay = utcDate.getUTCDate();
  const uHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60 + utcDate.getUTCSeconds() / 3600;

  const jdUT = swe.julday(uYear, uMonth, uDay, uHour);
  const sidTime = swe.sidtime(jdUT);
  const hsys = input.houseSystem || 'P';

  const housesRes = swe.houses(jdUT, input.latitude, input.longitude, hsys);
  const rawCusps: number[] = [];
  for (let i = 1; i <= 12; i++) {
    rawCusps.push(housesRes.cusps[i]);
  }

  const ascLon = housesRes.ascmc[0];
  const mcLon = housesRes.ascmc[1];
  const dscLon = (ascLon + 180) % 360;
  const icLon = (mcLon + 180) % 360;

  const houseCusps: HouseCuspData[] = rawCusps.map((lon, idx) => {
    const num = idx + 1;
    const isCardo = num === 1 || num === 4 || num === 7 || num === 10;
    const label = num === 1 ? 'ASC' : num === 4 ? 'IC' : num === 7 ? 'DSC' : num === 10 ? 'MC' : num.toString();
    const fmt = formatLongitude(lon);
    const meta = HOUSE_MEANINGS[num];

    return {
      num,
      lon,
      label,
      isCardo,
      title: `House ${num} · ${meta.name}`,
      desc: `${fmt.sign.name} ${fmt.deg.toString().padStart(2, '0')}°${fmt.min.toString().padStart(2, '0')}' — ${meta.domain}`,
      signName: fmt.sign.name,
      signGlyph: fmt.sign.glyph,
      formattedDeg: `${fmt.deg.toString().padStart(2, '0')}°${fmt.min.toString().padStart(2, '0')}' ${fmt.sign.name}`,
    };
  });

  const bodyDefs = [
    { id: 'Sun', name: 'Sun', code: swe.SE_SUN, glyph: '☉', color: '#eab308' }, // Bold Brilliant Gold Bauble
    { id: 'Moon', name: 'Moon', code: swe.SE_MOON, glyph: '☽', color: '#2563eb' }, // Bold Royal Sapphire Blue Bauble (High Contrast)
    { id: 'Mars', name: 'Mars', code: swe.SE_MARS, glyph: '♂', color: '#dc2626' }, // Bold Ruby Crimson Bauble
    { id: 'Mercury', name: 'Mercury', code: swe.SE_MERCURY, glyph: '☿', color: '#059669' }, // Bold Emerald Green Bauble
    { id: 'Venus', name: 'Venus', code: swe.SE_VENUS, glyph: '♀', color: '#e11d48' }, // Bold Ruby Rose Magenta Bauble
    { id: 'Pluto', name: 'Pluto', code: swe.SE_PLUTO, glyph: '♇', color: '#991b1b' }, // Deep Garnet Wine Red Bauble
    { id: 'Jupiter', name: 'Jupiter', code: swe.SE_JUPITER, glyph: '♃', color: '#d97706' }, // Rich Golden Amber Topaz Bauble
    { id: 'Chiron', name: 'Chiron', code: swe.SE_CHIRON, glyph: '⚷', color: '#0d9488' }, // Bold Sea Turquoise Bauble
    { id: 'Saturn', name: 'Saturn', code: swe.SE_SATURN, glyph: '♄', color: '#b45309' }, // Bold Terracotta Bronze Bauble
    { id: 'Uranus', name: 'Uranus', code: swe.SE_URANUS, glyph: '♅', color: '#0284c7' }, // Electric Peacock Cyan Bauble
    { id: 'Neptune', name: 'Neptune', code: swe.SE_NEPTUNE, glyph: '♆', color: '#4f46e5' }, // Royal Cobalt Velvet Bauble
    { id: 'TrueNode', name: 'TrueNode', code: swe.SE_TRUE_NODE, glyph: '☊', color: '#ca8a04' }, // Lustrous Antique Brass Gold Bauble
  ];

  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;
  const rawBodies: NatalBodyData[] = bodyDefs.map((b) => {
    let calcRes: Float64Array;
    try {
      calcRes = swe.calc_ut(jdUT, b.code, flags);
    } catch {
      calcRes = swe.calc_ut(jdUT, b.code, swe.SEFLG_MOSEPH | swe.SEFLG_SPEED);
    }

    const lon = calcRes[0];
    const lat = calcRes[1];
    const speed = calcRes[3];
    const isRetrograde = speed < 0;
    const fmt = formatLongitude(lon);
    const house = getHouseForLongitude(lon, rawCusps);
    const retroLabel = isRetrograde ? ' (Rx)' : '';

    return {
      id: b.id,
      name: b.name,
      glyph: b.glyph,
      lon,
      lat,
      speed,
      isRetrograde,
      signName: fmt.sign.name,
      signShort: fmt.sign.short,
      signGlyph: fmt.sign.glyph,
      degInSign: fmt.deg,
      minInSign: fmt.min,
      secInSign: fmt.sec,
      degText: fmt.shortText,
      fullDegText: fmt.fullText,
      house,
      color: b.color,
      tier: 0,
      clusterAngle: 0,
      detail: `${b.name} at ${fmt.deg.toString().padStart(2, '0')}°${fmt.min.toString().padStart(2, '0')}' ${fmt.sign.name}${retroLabel} in House ${house} · ${PLANET_ARCHETYPES[b.id] || ''}`,
    };
  });

  // Compute smart anti-collision tiers & clusterAngles for closely grouped planets
  const sortedByLon = [...rawBodies].sort((a, b) => a.lon - b.lon);
  for (let i = 0; i < sortedByLon.length; i++) {
    const curr = sortedByLon[i];
    const neighbors: NatalBodyData[] = [];
    for (let j = 0; j < i; j++) {
      const prev = sortedByLon[j];
      const dist = Math.min(
        Math.abs(curr.lon - prev.lon),
        360 - Math.abs(curr.lon - prev.lon)
      );
      if (dist < 10.5) {
        neighbors.push(prev);
      }
    }
    if (neighbors.length > 0) {
      const usedTiers = new Set(neighbors.map((n) => n.tier));
      let assignedTier = 0;
      while (usedTiers.has(assignedTier) && assignedTier < 3) {
        assignedTier++;
      }
      curr.tier = assignedTier;
      if (assignedTier === 1) curr.clusterAngle = -0.045;
      else if (assignedTier === 2) curr.clusterAngle = 0.045;
      else if (assignedTier >= 3) curr.clusterAngle = -0.075;
    }
  }

  // Compute major geometric aspects between planets
  const aspectDefs: Array<{
    type: AspectChordData['type'];
    angle: number;
    orb: number;
    symbol: string;
    color: number;
    colorHex: string;
    desc: string;
  }> = [
    {
      type: 'Conjunction',
      angle: 0,
      orb: 8,
      symbol: '☌',
      color: 0xffdf80,
      colorHex: '#ffdf80',
      desc: 'Close alignment brings these planetary themes together.',
    },
    {
      type: 'Opposition',
      angle: 180,
      orb: 8,
      symbol: '☍',
      color: 0xff3b3b,
      colorHex: '#ff3b3b',
      desc: 'Polarized tension demanding conscious integration and relational balance.',
    },
    {
      type: 'Square',
      angle: 90,
      orb: 7.5,
      symbol: '□',
      color: 0xff5555,
      colorHex: '#ff5555',
      desc: 'Dynamic friction and structural testing that catalyzes decisive mastery.',
    },
    {
      type: 'Trine',
      angle: 120,
      orb: 7.5,
      symbol: '△',
      color: 0x2563eb,
      colorHex: '#2563eb',
      desc: 'Harmonic elemental flow enabling natural creative synthesis and grace.',
    },
    {
      type: 'Sextile',
      angle: 60,
      orb: 5.5,
      symbol: '⚹',
      color: 0x38bdf8,
      colorHex: '#38bdf8',
      desc: 'Complementary opportunity inviting active collaboration and skill.',
    },
  ];

  const aspectCandidateBodies = rawBodies.filter((b) => b.id !== 'TrueNode');
  const detectedAspects: AspectChordData[] = [];

  for (let i = 0; i < aspectCandidateBodies.length; i++) {
    for (let j = i + 1; j < aspectCandidateBodies.length; j++) {
      const b1 = aspectCandidateBodies[i];
      const b2 = aspectCandidateBodies[j];
      let diff = Math.abs(b1.lon - b2.lon);
      if (diff > 180) diff = 360 - diff;

      for (const asp of aspectDefs) {
        const orb = Math.abs(diff - asp.angle);
        if (orb <= asp.orb) {
          detectedAspects.push({
            from: b1.name,
            to: b2.name,
            fromGlyph: b1.glyph,
            toGlyph: b2.glyph,
            type: asp.type,
            symbol: asp.symbol,
            angle: asp.angle,
            orb: Number(orb.toFixed(2)),
            color: asp.color,
            colorHex: asp.colorHex,
            name: `${b1.name} ${asp.symbol} ${b2.name} (${asp.angle}°)`,
            detail: `${asp.type} (Orb ${orb.toFixed(1)}°) · ${b1.name} in ${b1.signName} ${asp.symbol} ${b2.name} in ${b2.signName}. ${asp.desc}`,
          });
          break;
        }
      }
    }
  }

  detectedAspects.sort((a, b) => a.orb - b.orb);

  const ascFmt = formatLongitude(ascLon);
  const mcFmt = formatLongitude(mcLon);
  const sunBody = rawBodies.find((b) => b.id === 'Sun')!;
  const moonBody = rawBodies.find((b) => b.id === 'Moon')!;
  const sunFmt = formatLongitude(sunBody.lon);
  const moonFmt = formatLongitude(moonBody.lon);

  let version = '2.10.03';
  try {
    version = swe.version() || '2.10.03';
  } catch {
    // ignore
  }

  return {
    input,
    julianDayUT: jdUT,
    siderealTimeHours: sidTime,
    ascLon,
    mcLon,
    dscLon,
    icLon,
    ascFormatted: `AC: ${ascFmt.badgeText}`,
    mcFormatted: `MC: ${mcFmt.badgeText}`,
    sunFormatted: `Sun: ${sunFmt.badgeText}`,
    moonFormatted: `Moon: ${moonFmt.badgeText}`,
    houseCusps,
    natalBodies: rawBodies,
    aspectChords: detectedAspects,
    engineVersion: version,
  };
}
