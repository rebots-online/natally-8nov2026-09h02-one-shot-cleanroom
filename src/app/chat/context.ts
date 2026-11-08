// Conversation context for Natally (DOCS/ARCHITECTURE.md §Inference):
// system = persona + compact chart facts + compact backstory, then turns.
// No token math anywhere — the server owns completion budgeting.

import { BACKSTORY_ANSWERS, type BackstoryAnswer } from '../../content/backstory';
import { NATALLY_SYSTEM_PROMPT } from '../../content/persona';
import type { ChatMessage, NatalChart, ZodiacSign } from '../../shared/types';

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
 * one-line anchor for the vignette shelf, so streamed replies never
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

/** System + trimmed conversation, ready for the wire. */
export function buildMessages(
  history: ChatMessage[],
  chart: NatalChart,
): ContextMessage[] {
  const messages: ContextMessage[] = [
    {
      role: 'system',
      content: `${NATALLY_SYSTEM_PROMPT}\n\nNATAL CHART FACTS\n${chartFacts(chart)}\n\nNATALLY'S OWN STORY\n${backstoryBlock()}`,
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
