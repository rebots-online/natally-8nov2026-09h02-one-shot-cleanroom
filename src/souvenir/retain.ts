// W12 SOUVENIR — local retention of a purchased keepsake
// (DOCS/ARCHITECTURE.md §Surfaces, Souvenir). A purchase retains
// {report, chart, at} under `natally.souvenir.<uid>` so the interactive
// viewer and PDF re-downloads work without another purchase.

import type { NatalChart } from '../shared/types';
import type { SouvenirReport } from './report';

/** What a finished purchase retains per customer. */
export interface RetainedSouvenir {
  report: SouvenirReport;
  chart: NatalChart;
  /** Epoch milliseconds of the purchase that produced this keepsake. */
  at: number;
}

/** Boundary guard for JSON read back from localStorage. */
function isRetainedSouvenir(value: unknown): value is RetainedSouvenir {
  if (typeof value !== 'object' || value === null) return false;
  const { report, chart, at } = value as {
    report?: unknown;
    chart?: unknown;
    at?: unknown;
  };
  if (typeof report !== 'object' || report === null || typeof at !== 'number') {
    return false;
  }
  const { title, sections } = report as { title?: unknown; sections?: unknown };
  if (typeof title !== 'string' || !Array.isArray(sections)) return false;
  for (const section of sections) {
    if (typeof section !== 'object' || section === null) return false;
    const { heading, body } = section as { heading?: unknown; body?: unknown };
    if (typeof heading !== 'string' || typeof body !== 'string') return false;
  }
  if (typeof chart !== 'object' || chart === null) return false;
  const { input, bodies, houses, ascendant, midheaven, aspects } = chart as {
    input?: unknown;
    bodies?: unknown;
    houses?: unknown;
    ascendant?: unknown;
    midheaven?: unknown;
    aspects?: unknown;
  };
  return (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray(bodies) &&
    Array.isArray(houses) &&
    houses.length === 12 &&
    typeof ascendant === 'object' &&
    ascendant !== null &&
    typeof midheaven === 'object' &&
    midheaven !== null &&
    Array.isArray(aspects)
  );
}

/**
 * Retain a purchased keepsake for `uid`. Returns false when storage refuses
 * (private mode, quota) — the PDF download has already succeeded by then.
 */
export function saveSouvenir(uid: string, report: SouvenirReport, chart: NatalChart): boolean {
  const record: RetainedSouvenir = { report, chart, at: Date.now() };
  try {
    localStorage.setItem(`natally.souvenir.${uid}`, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/** The retained keepsake for `uid`, or null when absent or unreadable. */
export function loadSouvenir(uid: string): RetainedSouvenir | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(`natally.souvenir.${uid}`);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isRetainedSouvenir(parsed) ? parsed : null;
}
