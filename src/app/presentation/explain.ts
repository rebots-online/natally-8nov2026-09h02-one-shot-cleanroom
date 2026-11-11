// Spoken explain passages for tapped chart components (architecture §5,
// INSET): a tap names a target — a body, a sign, a house, or an aspect line —
// and this module composes Natally's reply from authored material only
// (content/lessons, chart/liveReading, exact chart facts), embedding the same
// presentation cues her chat replies carry so the passage flows through
// parseReply and the playback driver unchanged. Composition is authored,
// never inferred; an unrecognized or unverifiable target throws rather than
// pretending to a reading.

import { getLesson } from '../../content/lessons';
import { composeLiveReading, type SkyPlacement } from '../../chart/liveReading';
import type {
  Aspect,
  AspectKind,
  ChartBody,
  ChartBodyKey,
  NatalChart,
  ZodiacSign,
} from '../../shared/types';

/** Why an explanation is being composed: a customer tap, or her own cue. */
export type ExplainSource = 'tap' | 'cue';

/**
 * The highlightable name of an aspect line. Natal lines read
 * `"Sun trine Moon"`; current-sky-to-natal lines read
 * `"now Mars square Venus"` — kind lower-case, `a` the moving body in
 * today's sky, `b` the natal body. now-to-now lines do not exist by design.
 */
export function aspectTargetName(
  a: ChartBodyKey,
  kind: AspectKind,
  b: ChartBodyKey,
  now: boolean,
): string {
  return now ? `now ${a} ${kind} ${b}` : `${a} ${kind} ${b}`;
}

/**
 * Every element a passage about `target` should walk, in speaking order:
 * a body yields the body, its sign, its house (known birth time only) and
 * each natal aspect line involving it; a sign or house yields itself and
 * the bodies living in it; a natal aspect line yields itself and its two
 * bodies. now-to-natal lines cannot be established from the chart alone
 * and throw; `explainTarget` handles them with the live sky.
 */
export function involvedElements(target: string, chart: NatalChart): string[] {
  const signs: readonly ZodiacSign[] = [
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
  const timed = chart.input.timeIso !== null;

  const body = chart.bodies.find(entry => entry.key === target);
  if (body) {
    const elements: string[] = [body.key, body.sign];
    if (timed) elements.push(`House ${body.house}`);
    for (const aspect of chart.aspects) {
      if (aspect.a === body.key || aspect.b === body.key) {
        elements.push(aspectTargetName(aspect.a, aspect.kind, aspect.b, false));
      }
    }
    return elements;
  }

  if ((signs as readonly string[]).includes(target)) {
    return [target, ...chart.bodies.filter(entry => entry.sign === target).map(entry => entry.key)];
  }

  const houseMatch = /^House ([1-9]|1[0-2])$/.exec(target);
  if (houseMatch) {
    if (!timed) throw new TypeError(`House targets need a known birth time: ${target}`);
    const house = Number(houseMatch[1]);
    return [target, ...chart.bodies.filter(entry => entry.house === house).map(entry => entry.key)];
  }

  const tokens = target.split(' ');
  if (tokens.length === 3) {
    const aspect = chart.aspects.find(
      entry =>
        entry.kind === tokens[1] &&
        ((entry.a === tokens[0] && entry.b === tokens[2]) ||
          (entry.a === tokens[2] && entry.b === tokens[0])),
    );
    if (aspect) return [target, aspect.a, aspect.b];
  }

  throw new TypeError(`Not a chart target with elements: ${target}`);
}

/**
 * Her spoken passage about `target`, as reply text with embedded cues:
 * `[[view:chart]]` first, a cue for every involved element as the passage
 * reaches it (element by element, in `involvedElements` order), the live
 * placement statement from chart/liveReading when the sky is supplied, and
 * `[[chart:clear]]` at the end. `sky`, when not null, must be parallel to
 * `chart.bodies` — `sky[i]` is where `chart.bodies[i].key` stands right now
 * — or a TypeError is thrown; null degrades truthfully to the natal chart
 * alone (and now-to-natal targets throw: they cannot be verified without it).
 */
export function explainTarget(
  target: string,
  chart: NatalChart,
  sky: SkyPlacement[] | null,
): string {
  if (sky !== null && sky.length !== chart.bodies.length) {
    throw new TypeError(
      `sky must be parallel to chart.bodies (${chart.bodies.length} placements, got ${sky.length})`,
    );
  }

  const signs: readonly ZodiacSign[] = [
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
  const kinds: readonly AspectKind[] = [
    'conjunction',
    'sextile',
    'square',
    'trine',
    'opposition',
  ];
  const angles: readonly { kind: AspectKind; angle: number }[] = [
    { kind: 'conjunction', angle: 0 },
    { kind: 'sextile', angle: 60 },
    { kind: 'square', angle: 90 },
    { kind: 'trine', angle: 120 },
    { kind: 'opposition', angle: 180 },
  ];
  const ordinals = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth',
    'sixth',
    'seventh',
    'eighth',
    'ninth',
    'tenth',
    'eleventh',
    'twelfth',
  ] as const;
  const gloss: Record<AspectKind, string> = {
    conjunction: 'the two share one voice at the same degrees',
    sextile: 'a quiet, usable opening runs between them',
    square: 'they lean on each other at a right angle — friction that builds',
    trine: 'they run on easy, friendly terms by default',
    opposition: 'they face each other across the wheel, one long negotiation',
  };
  const verb: Record<AspectKind, string> = {
    conjunction: 'sits right on top of',
    sextile: 'slides an easy sextile to',
    square: 'squares',
    trine: 'trines',
    opposition: 'stands directly opposite',
  };

  const timed = chart.input.timeIso !== null;
  const degreeWord = (longitude: number): string =>
    `${Math.floor(((longitude % 30) + 30) % 30)}°`;
  const ordinalHouse = (house: number): string => ordinals[house - 1] ?? `${house}th`;
  const signOf = (longitude: number): ZodiacSign =>
    signs[Math.floor((((longitude % 360) + 360) % 360) / 30)] ?? 'Aries';
  const lessonText = (key: ChartBodyKey): string => getLesson(key).what.replace(/\s+$/, '');
  const sentence = (text: string): string =>
    text.charAt(0).toUpperCase() + text.slice(1);

  // The current placement of one body, or null when the sky is absent.
  const currentOf = (key: ChartBodyKey): SkyPlacement | null => {
    if (sky === null) return null;
    const index = chart.bodies.findIndex(entry => entry.key === key);
    return index >= 0 ? (sky[index] ?? null) : null;
  };

  // Closest of the five aspect angles within 7° — the same standard as
  // chart/liveReading's live check, so a cued line and its spoken sentence
  // can never disagree.
  const liveKindBetween = (aLon: number, bLon: number): { kind: AspectKind; orb: number } | null => {
    const raw = Math.abs((((aLon - bLon) % 360) + 360) % 360);
    const separation = Math.min(raw, 360 - raw);
    let best: { kind: AspectKind; orb: number } | null = null;
    for (const { kind, angle } of angles) {
      const orb = Math.abs(separation - angle);
      if (orb <= 7 && (best === null || orb < best.orb)) best = { kind, orb };
    }
    return best;
  };

  const bodyPassage = (body: ChartBody): string => {
    const base = lessonText(body.key);
    const pieces: string[] = [];
    for (const element of involvedElements(body.key, chart)) {
      const cue = `[[chart:${element}]]`;
      if (element === body.key) {
        pieces.push(`${cue}${base}`);
      } else if (element === body.sign) {
        pieces.push(
          `${cue}In your chart it stands in ${body.sign}, at ${degreeWord(body.position.longitude)} of the sign.`,
        );
      } else if (element === `House ${body.house}`) {
        pieces.push(
          `${cue}It plays all of that out in your ${ordinalHouse(body.house)} house — the room of life where this part of you shows most.`,
        );
      } else {
        const aspect = chart.aspects.find(
          entry => aspectTargetName(entry.a, entry.kind, entry.b, false) === element,
        );
        if (aspect) {
          const other = aspect.a === body.key ? aspect.b : aspect.a;
          pieces.push(
            `${cue}It holds a ${aspect.kind} with your natal ${other} — ${aspect.orb.toFixed(1)}° from exact; ${gloss[aspect.kind]}.`,
          );
        }
      }
    }
    // The live placement statement, in chart/liveReading's authored voice.
    const current = currentOf(body.key);
    if (current) {
      const full = composeLiveReading(
        body.key,
        { sign: body.sign, lon: body.position.longitude },
        current,
      );
      const tail = full.startsWith(base) ? full.slice(base.length).trim() : full;
      if (tail !== '') {
        const live = liveKindBetween(current.lon, body.position.longitude);
        pieces.push(
          `${live ? `[[chart:${aspectTargetName(body.key, live.kind, body.key, true)}]]` : ''}${tail}`,
        );
      }
    }
    pieces.push(getLesson(body.key).question);
    pieces.push('[[chart:clear]]');
    return `[[view:chart]]${pieces.join(' ')}`;
  };

  const signPassage = (sign: ZodiacSign): string => {
    const index = signs.indexOf(sign);
    const element = ['Fire', 'Earth', 'Air', 'Water'][index < 0 ? 0 : index % 4]!;
    const modality = ['Cardinal', 'Fixed', 'Mutable'][index < 0 ? 0 : index % 3]!;
    const occupants = involvedElements(sign, chart).slice(1);
    const pieces: string[] = [
      `[[view:chart]][[chart:${sign}]]${sign} is the ${ordinalHouse(index + 1)} sign of the zodiac — ${modality} ${element} — ${
        occupants.length === 0
          ? 'and no planet or point of yours stands here; the wheel still carries its colour through the houses it covers, but no natal body answers to it.'
          : `and ${occupants.length === 1 ? 'one placement of yours answers to it' : `${occupants.length} placements of yours answer to it`}.`
      }`,
    ];
    for (const name of occupants) {
      const body = chart.bodies.find(entry => entry.key === name);
      if (body) {
        pieces.push(
          `[[chart:${body.key}]]Your ${body.key} at ${degreeWord(body.position.longitude)}${timed ? `, in your ${ordinalHouse(body.house)} house` : ''}.`,
        );
      }
    }
    if (occupants.length > 0) pieces.push('Tap any of them and I will take you deeper.');
    pieces.push('[[chart:clear]]');
    return pieces.join(' ');
  };

  const housePassage = (house: number): string => {
    const cusp = chart.houses[house - 1];
    const occupants = involvedElements(`House ${house}`, chart).slice(1);
    const pieces: string[] = [
      `[[view:chart]][[chart:House ${house}]]Your ${ordinalHouse(house)} house opens at ${
        cusp ? `${degreeWord(cusp.position.longitude)} of ${signOf(cusp.position.longitude)}` : 'an unplaced cusp'
      } — ${
        occupants.length === 0
          ? 'and it stands empty: no natal body staffs this room, so its themes run quietly in the background of your chart.'
          : `and ${occupants.length === 1 ? 'one placement of yours lives here' : `${occupants.length} placements of yours live here`}.`
      }`,
    ];
    for (const name of occupants) {
      const body = chart.bodies.find(entry => entry.key === name);
      if (body) {
        pieces.push(
          `[[chart:${body.key}]]Your ${body.key} in ${body.sign}, at ${degreeWord(body.position.longitude)} of the sign.`,
        );
      }
    }
    if (occupants.length > 0) pieces.push('Tap any of them and I will take you deeper.');
    pieces.push(getLesson('general').question);
    pieces.push('[[chart:clear]]');
    return pieces.join(' ');
  };

  const natalLinePassage = (aspect: Aspect): string => {
    const a = chart.bodies.find(entry => entry.key === aspect.a);
    const b = chart.bodies.find(entry => entry.key === aspect.b);
    const where = (body: ChartBody): string =>
      `${body.sign}${timed ? ` (${ordinalHouse(body.house)} house)` : ''}`;
    return [
      `[[view:chart]][[chart:${aspectTargetName(aspect.a, aspect.kind, aspect.b, false)}]]A ${aspect.kind} joins ${
        a ? `your ${aspect.a} in ${where(a)}` : `your ${aspect.a}`
      } and ${b ? `your ${aspect.b} in ${where(b)}` : `your ${aspect.b}`} — ${aspect.orb.toFixed(1)}° from exact; ${gloss[aspect.kind]}.`,
      `[[chart:${aspect.a}]]${lessonText(aspect.a)}`,
      `[[chart:${aspect.b}]]${lessonText(aspect.b)}`,
      getLesson(aspect.a).question,
      '[[chart:clear]]',
    ].join(' ');
  };

  const nowLinePassage = (a: ChartBodyKey, kind: AspectKind, b: ChartBodyKey): string => {
    const current = currentOf(a);
    const natalB = chart.bodies.find(entry => entry.key === b);
    const live = current && natalB ? liveKindBetween(current.lon, natalB.position.longitude) : null;
    if (!current || !natalB || !live || live.kind !== kind) {
      throw new TypeError(`now-to-natal target not verified by the live sky: ${target}`);
    }
    return [
      `[[view:chart]][[chart:${aspectTargetName(a, kind, b, true)}]]Live sky: ${a} is cruising through ${current.sign} and ${verb[kind]} your natal ${b} in ${natalB.sign}${timed ? ` (${ordinalHouse(natalB.house)} house)` : ''} — ${live.orb.toFixed(1)}° from exact, as of today. ${sentence(gloss[kind])}, and today it lands on your ${b}.`,
      `[[chart:${a}]]${lessonText(a)} That is the part of you doing the walking right now.`,
      `[[chart:${b}]]Your natal ${b} in ${natalB.sign} is the receiving end — where this week's weather actually lands.`,
      getLesson(a).question,
      '[[chart:clear]]',
    ].join(' ');
  };

  const body = chart.bodies.find(entry => entry.key === target);
  if (body) return bodyPassage(body);
  if ((signs as readonly string[]).includes(target)) return signPassage(target as ZodiacSign);
  const houseMatch = /^House ([1-9]|1[0-2])$/.exec(target);
  if (houseMatch) {
    if (!timed) throw new TypeError(`House targets need a known birth time: ${target}`);
    return housePassage(Number(houseMatch[1]));
  }

  const tokens = target.split(' ');
  const isNowLine = tokens.length === 4 && tokens[0] === 'now';
  const isNatalLine = tokens.length === 3;
  if (isNowLine || isNatalLine) {
    const rest = isNowLine ? tokens.slice(1) : tokens;
    const [rawA, rawKind, rawB] = rest;
    const a = chart.bodies.find(entry => entry.key === rawA);
    const b = chart.bodies.find(entry => entry.key === rawB);
    const kind = (kinds as readonly string[]).includes(rawKind ?? '')
      ? (rawKind as AspectKind)
      : undefined;
    if (!a || !b || !kind) {
      throw new TypeError(`Not an aspect line Natally can explain: ${target}`);
    }
    if (isNowLine) {
      if (a.key === 'Ascendant' || a.key === 'Midheaven') {
        throw new TypeError(`The angles of the moment do not head now-to-natal lines: ${target}`);
      }
      if (sky === null) {
        throw new TypeError(`now-to-natal targets need the live sky: ${target}`);
      }
      return nowLinePassage(a.key, kind, b.key);
    }
    const aspect = chart.aspects.find(
      entry =>
        entry.kind === kind &&
        ((entry.a === a.key && entry.b === b.key) || (entry.a === b.key && entry.b === a.key)),
    );
    if (!aspect) throw new TypeError(`No such natal aspect in this chart: ${target}`);
    return natalLinePassage(aspect);
  }

  throw new TypeError(`Not a chart target Natally can explain: ${target}`);
}
