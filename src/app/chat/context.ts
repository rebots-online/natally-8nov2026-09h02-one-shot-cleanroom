// Conversation context for Natally (DOCS/ARCHITECTURE.md §Inference):
// system = persona + compact chart facts + compact backstory, then turns.
// No token math anywhere — the server owns completion budgeting.

import { BACKSTORY_ANSWERS, type BackstoryAnswer } from '../../content/backstory';
import { NATALLY_SYSTEM_PROMPT } from '../../content/persona';
import { aspectTargetName } from '../presentation/explain';
import type { SkyPlacement } from '../../chart/liveReading';
import type { AspectKind, ChatMessage, NatalChart, ZodiacSign } from '../../shared/types';

/** Roles carried on the inference wire. */
export type ContextRole = 'system' | 'user' | 'assistant';

/** One wire message, OpenRouter chat-completions shape. */
export interface ContextMessage {
 role: ContextRole;
 content: string;
}

/** Conversation turns kept per request (spec: last 20 messages). */
export const MAX_CONTEXT_MESSAGES = 20;

const SIGNS: readonly ZodiacSign[] = [
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

const HOUSE_ORDINALS = [
 '1st',
 '2nd',
 '3rd',
 '4th',
 '5th',
 '6th',
 '7th',
 '8th',
 '9th',
 '10th',
 '11th',
 '12th',
] as const;

/** Sign holding a tropical ecliptic longitude. */
function signOf(longitude: number): ZodiacSign {
 const degrees = ((longitude % 360) + 360) % 360;
 return SIGNS[Math.floor(degrees / 30)]!;
}

/** Degrees travelled within the sign, e.g. `12.34°`. */
function degreeInSign(longitude: number): string {
 const within = ((longitude % 30) + 30) % 30;
 return `${within.toFixed(2)}°`;
}

/** Compact, one-line-per-fact rendering of a natal chart. */
export function chartFacts(chart: NatalChart): string {
 const lines: string[] = [];

 const { input } = chart;
 const when = input.timeIso
  ? `${input.dateIso} at ${input.timeIso}`
  : `${input.dateIso} (birth time unknown)`;
 lines.push(`Born ${when} in ${input.place.label}.`);

 lines.push(
  `Ascendant: ${signOf(chart.ascendant.longitude)} ${degreeInSign(chart.ascendant.longitude)}`,
 );
 lines.push(
  `Midheaven: ${signOf(chart.midheaven.longitude)} ${degreeInSign(chart.midheaven.longitude)}`,
 );

 // Ascendant/Midheaven already have their own lines above.
 for (const body of chart.bodies) {
  if (body.key === 'Ascendant' || body.key === 'Midheaven') continue;
  lines.push(
   `${body.key} in ${body.sign}, ${HOUSE_ORDINALS[body.house - 1]} house (${degreeInSign(body.position.longitude)})`,
  );
 }

 for (const aspect of chart.aspects) {
  lines.push(`${aspect.a} ${aspect.kind} ${aspect.b}, orb ${aspect.orb.toFixed(1)}°`);
 }

 return lines.join('\n');
}

/**
 * Compact backstory digest: her canonical self-answers verbatim plus a
 * one-line anchor for the vignette canon, so streamed replies never
 * contradict the authored material.
 */
function backstoryBlock(): string {
 const answers = BACKSTORY_ANSWERS.map(
  (entry) => `Q: ${entry.question}\nA: ${entry.answer}`,
 );
 return [
  'When the customer asks about Natally herself, these are her canonical answers; stay consistent with them.',
  ...answers,
  "Her backstage holds a grandmother's annotated ephemeris, a decorative brass telescope, postcards above the desk, and a cat named Umbra; never contradict these details.",
 ].join('\n');
}

/** Lowercased phrase triggers, parallel to BACKSTORY_ANSWERS. */
const BACKSTORY_TRIGGERS: readonly string[] = [
 'who are you',
 'do you believe',
 'your sign',
 'how did you learn',
];

/** The authored answer for a persona question, or null for chart talk. */
export function backstoryAnswerFor(text: string): BackstoryAnswer | null {
 const lowered = text.toLowerCase();
 for (let i = 0; i < BACKSTORY_TRIGGERS.length; i++) {
  const trigger = BACKSTORY_TRIGGERS[i];
  if (trigger !== undefined && lowered.includes(trigger) && i < BACKSTORY_ANSWERS.length) {
   return BACKSTORY_ANSWERS[i] ?? null;
  }
 }
 return null;
}

/**
 * Every target a presentation cue may name for this chart: bodies, signs,
 * houses (known birth time only), natal aspect lines, and — when today's
 * sky is supplied — current-sky-to-natal aspect lines ("now Mars square
 * Venus"; no now-to-now lines exist by design). `sky` must be parallel to
 * `chart.bodies` — `sky[i]` is where `chart.bodies[i].key` stands right
 * now — or a TypeError is thrown; absent sky simply offers no now-lines,
 * never guessed ones.
 */
export function chartTargets(chart: NatalChart, sky?: SkyPlacement[] | null): Set<string> {
 const targets = new Set<string>(chart.bodies.map(body => body.key));
 for (const sign of SIGNS) targets.add(sign);
 if (chart.input.timeIso !== null) for (let house = 1; house <= 12; house++) targets.add(`House ${house}`);

 for (const aspect of chart.aspects) {
  targets.add(aspectTargetName(aspect.a, aspect.kind, aspect.b, false));
 }

 if (sky) {
  if (sky.length !== chart.bodies.length) {
   throw new TypeError(
    `sky must be parallel to chart.bodies (${chart.bodies.length} placements, got ${sky.length})`,
   );
  }
  // The five aspect angles with the tightest orb within 7° — the same
  // standard chart/liveReading's live check uses, so the inventory only
  // names lines the live passages can verify.
  const angles: readonly { kind: AspectKind; angle: number }[] = [
   { kind: 'conjunction', angle: 0 },
   { kind: 'sextile', angle: 60 },
   { kind: 'square', angle: 90 },
   { kind: 'trine', angle: 120 },
   { kind: 'opposition', angle: 180 },
  ];
  for (let i = 0; i < chart.bodies.length; i++) {
   const moving = chart.bodies[i]!;
   // The angles of the moment do not head transit lines; the moving sky does.
   if (moving.key === 'Ascendant' || moving.key === 'Midheaven') continue;
   for (let j = 0; j < chart.bodies.length; j++) {
    const natal = chart.bodies[j]!;
    const raw = Math.abs((((sky[i]!.lon - natal.position.longitude) % 360) + 360) % 360);
    const separation = Math.min(raw, 360 - raw);
    let best: { kind: AspectKind; orb: number } | null = null;
    for (const { kind, angle } of angles) {
     const orb = Math.abs(separation - angle);
     if (orb <= 7 && (best === null || orb < best.orb)) best = { kind, orb };
    }
    if (best) targets.add(aspectTargetName(moving.key, best.kind, natal.key, true));
   }
  }
 }

 return targets;
}

/** Instructions for driving the live stage while she narrates. */
function presentationBlock(chart: NatalChart, sky: SkyPlacement[] | null): string {
 return [
  'You control the live stage while you talk, with hidden commands that are never shown or spoken:',
  '[[view:chart]] brings the wheel forward (you become the small inset); [[view:atelier]] brings you back.',
  '[[chart:TARGET;TARGET]] highlights up to 6 targets; [[chart:clear]] un-highlights.',
  'Place each command immediately before the passage it governs, never all at the start.',
  'Bring the wheel forward before you explain any part of the chart, highlight each element as you reach it — a body, its sign, its house — and [[chart:clear]] between emphases.',
  'Aspect lines are targets too: name the relationship exactly as listed and the line lights on the wheel.' +
   (sky === null
    ? ''
    : " Lines that begin with \"now\" run from today's sky to the natal chart."),
  'Use [[view:atelier]] when you turn to reflection or to yourself.',
  `Exact targets for this chart: ${JSON.stringify([...chartTargets(chart, sky)])}`,
 ].join('\n');
}

/** System + trimmed conversation, ready for the wire. */
export function buildMessages(
 history: ChatMessage[],
 chart: NatalChart,
 sky?: SkyPlacement[] | null,
): ContextMessage[] {
 const messages: ContextMessage[] = [
  {
   role: 'system',
   content: `${NATALLY_SYSTEM_PROMPT}\n\nNATAL CHART FACTS\n${chartFacts(chart)}\n\nLIVE STAGE\n${presentationBlock(chart, sky ?? null)}\n\nNATALLY'S OWN STORY\n${backstoryBlock()}`,
  },
 ];

 for (const message of history.slice(-MAX_CONTEXT_MESSAGES)) {
  messages.push({
   role: message.role === 'user' ? 'user' : 'assistant',
   content: message.text,
  });
 }

 return messages;
}
