// Onboarding draft contract for the first-light intake
// (src/onboarding-original). The untouched components import the
// `IntakeDraft` type from here; this repo turns the draft into a
// `BirthInput` for src/astro's natalChart() in the onboarding wrapper
// (src/app/onboarding) — the composition owns persistence, exactly as the
// original's header comment prescribes.

import type { CurrentLocation } from './transits';

/** Reading voice the customer asked Natally for. */
export type ReadingStyle = 'plain' | 'poetic' | 'technical';

/** The first-light questionnaire result, verbatim from the original intake. */
export interface IntakeDraft {
  readonly readingStyle?: ReadingStyle;
  readonly name: string;
  readonly date: string;
  readonly time: string | null;
  readonly unknownTime: boolean;
  readonly placeId: string | null;
  readonly currentLocation?: CurrentLocation;
}
