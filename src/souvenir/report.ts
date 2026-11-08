// W12 SOUVENIR — the authored + chart-facts natal keepsake report
// (DOCS/ARCHITECTURE.md §Surfaces, Souvenir). Every line is authored copy
// rendered with the chart's actual placements, or a fact read off the chart
// itself: no inference, no invented customer data.

import { getLesson } from '../content/lessons';
import type { Aspect, AspectKind, BirthInput, ChartBody, NatalChart } from '../shared/types';

/** One section of the keepsake: a heading plus paragraph text. */
export interface ReportSection {
  heading: string;
  /**
   * Paragraphs separated by blank lines (`\n\n`); single `\n` inside a
   * paragraph is a hard line break.
   */
  body: string;
}

/** The full keepsake: cover title plus cover, per-body, aspects, closing. */
export interface SouvenirReport {
  title: string;
  sections: ReportSection[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Verb for each aspect kind in running text: "Sun trine Moon". */
const ASPECT_VERB: Record<AspectKind, string> = {
  conjunction: 'conjunct',
  opposition: 'opposite',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile',
};

/** `1983-07-14` → `14 July 1983`, parsed without timezone drift. */
function formatIsoDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName || !/^\d+$/.test(day) || !/^\d+$/.test(year)) return iso;
  return `${Number(day)} ${monthName} ${year}`;
}

function formatLatitude(degrees: number): string {
  return `${Math.abs(degrees).toFixed(1)}°${degrees >= 0 ? 'N' : 'S'}`;
}

function formatLongitude(degrees: number): string {
  return `${Math.abs(degrees).toFixed(1)}°${degrees >= 0 ? 'E' : 'W'}`;
}

/** Cover facts: name when given, then date, time, place, sky coordinates. */
function birthFacts(input: BirthInput): string[] {
  const lines: string[] = [];
  if (input.name) lines.push(`Name: ${input.name}`);
  lines.push(`Date of birth: ${formatIsoDate(input.dateIso)}`);
  lines.push(
    input.timeIso
      ? `Time of birth: ${input.timeIso} local time`
      : 'Time of birth: unknown — the sky is read without a birth time',
  );
  lines.push(`Place of birth: ${input.place.label}`);
  lines.push(
    `Coordinates: ${formatLatitude(input.place.latitude)}, ${formatLongitude(input.place.longitude)}`,
  );
  lines.push(`Time zone: ${input.place.timezoneIana}`);
  return lines;
}

/** A lesson rendered against the body's actual placement. */
function bodySection(body: ChartBody): ReportSection {
  const lesson = getLesson(body.key);
  const placement = `${body.key} in ${body.sign}, house ${body.house}`;
  return {
    heading: lesson.title,
    body: [
      `${placement} — ${lesson.what}`,
      `In the tradition: ${lesson.tradition}`,
      `A question to sit with: ${lesson.question}`,
    ].join('\n\n'),
  };
}

/** Every aspect the chart computed, as readable lines. */
function aspectsSection(aspects: Aspect[]): ReportSection {
  const lines = aspects.map(
    (aspect) =>
      `${aspect.a} ${ASPECT_VERB[aspect.kind]} ${aspect.b} — ${Math.abs(aspect.orb).toFixed(1)}° from exact`,
  );
  return {
    heading: 'The Conversations Between',
    body:
      lines.length > 0
        ? [
            'No point in your sky acts alone; each aspect is two voices that color each other.',
            lines.join('\n'),
          ].join('\n\n')
        : 'No major aspects fell within orb when your chart was cast; each voice in your sky stands on its own.',
  };
}

/** The closing page, from the general lesson. */
function closingSection(): ReportSection {
  const lesson = getLesson('general');
  return {
    heading: lesson.title,
    body: [
      lesson.what,
      `In the tradition: ${lesson.tradition}`,
      `A question to sit with: ${lesson.question}`,
    ].join('\n\n'),
  };
}

/**
 * Build the keepsake report from a computed natal chart: a cover of birth
 * facts, one section per chart body with its lesson at the actual placement,
 * the aspects between them, and a closing page.
 */
export function buildReport(chart: NatalChart): SouvenirReport {
  const input = chart.input;
  const now = new Date();
  return {
    title: input.name ? `${input.name} · A Keepsake of the Sky` : 'A Keepsake of the Sky',
    sections: [
      {
        heading: 'The Moment You Arrived',
        body: [
          ...birthFacts(input),
          `Prepared ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
        ].join('\n'),
      },
      ...chart.bodies.map(bodySection),
      aspectsSection(chart.aspects),
      closingSection(),
    ],
  };
}
