import { normalizeReadingStyle, type ReadingStyle } from './readingStyle';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { NatalChartInput } from './ephemeris';
import type { CurrentLocation } from './transits';
import { loadGazetteer, tzOffsetHours } from './gazetteer';

/**
 * First-light onboarding: the intake draft collected by the FirstLight
 * questionnaire, plus the persistence seam that turns it into the user's
 * one and only chart preset. No famous presets — the user's own sky is the
 * only sensible default once they've told us their birth data.
 */
export interface IntakeDraft {
  readonly readingStyle?: ReadingStyle;
  readonly name: string;
  readonly date: string;
  readonly time: string | null;
  readonly unknownTime: boolean;
  readonly placeId: string | null;
  readonly currentLocation?: CurrentLocation;
}

const NATAL_INTAKE_STORAGE_KEY = 'astrosphere_natal_intake_v1';

export function intakeToChartInput(draft: IntakeDraft): NatalChartInput {
  if (!draft.placeId) throw new Error('Choose a birth place from the list');
  const place = loadGazetteer().find((entry) => entry.id === draft.placeId);
  if (!place) throw new Error('Choose a birth place from the list');
  // Unknown time → noon stand-in + Whole Sign: no fabricated angles.
  const wallTime = draft.time ?? '12:00';
  return {
    name: draft.name,
    readingStyle: normalizeReadingStyle(draft.readingStyle),
    birthDate: draft.date,
    birthTime: wallTime,
    placeName: `${place.name}, ${place.countryCode}`,
    latitude: place.lat,
    longitude: place.lon,
    timezoneOffset: tzOffsetHours(place.tzid, draft.date, wallTime),
    houseSystem: draft.unknownTime ? 'W' : 'P',
    birthTimeUnknown: draft.unknownTime,
    ...(draft.currentLocation ? {
      currentLocationName: draft.currentLocation.name,
      currentLatitude: draft.currentLocation.latitude,
      currentLongitude: draft.currentLocation.longitude,
      currentTimezoneId: draft.currentLocation.timeZone,
    } : {}),
  };
}

export function loadNatalIntake(uid?: string): NatalChartInput | null {
  try {
    const saved = localStorage.getItem(uid ? `${NATAL_INTAKE_STORAGE_KEY}:${uid}` : NATAL_INTAKE_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as NatalChartInput;
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.birthDate === 'string' &&
      typeof parsed.birthTime === 'string' &&
      typeof parsed.placeName === 'string' &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number' &&
      typeof parsed.timezoneOffset === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function saveNatalIntake(input: NatalChartInput, uid?: string): void {
  try {
    localStorage.setItem(uid ? `${NATAL_INTAKE_STORAGE_KEY}:${uid}` : NATAL_INTAKE_STORAGE_KEY, JSON.stringify(input));
  } catch (_) {
    // Storage being unavailable must not block casting the chart.
  }
}

export function clearNatalIntake(uid?: string): void {
  try {
    localStorage.removeItem(uid ? `${NATAL_INTAKE_STORAGE_KEY}:${uid}` : NATAL_INTAKE_STORAGE_KEY);
  } catch (_) {}
}

/** Firestore intake storage failed in a way that suggests billing/quota —
 * continuing on the baked-in inference key in this state would spend
 * unmetered funds, so the journey must block instead. */
export class IntakeStorageBillingError extends Error {
  constructor(public readonly cause: unknown) {
    super('Cloud intake storage is unavailable (billing/quota). Blocking to protect funds.');
    this.name = 'IntakeStorageBillingError';
  }
}

const BILLING_CODES = new Set([
  'failed-precondition', // Firestore not enabled / billing removed mid-flight
  'resource-exhausted',  // quota
  'unavailable',         // sustained infra outage
]);

const isBillingClass = (err: unknown): boolean => {
  const code = (err as { code?: string })?.code ?? '';
  if (BILLING_CODES.has(code)) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return /billing|quota|exceeded|not enabled/.test(msg) && !/permission/.test(msg);
};

const intakeDoc = (uid: string) => doc(db, 'users', uid, 'private', 'intake');

export async function fetchUserIntake(uid: string): Promise<NatalChartInput | null> {
  try {
    const snap = await getDoc(intakeDoc(uid));
    const data = snap.data() as NatalChartInput | undefined;
    return snap.exists() && data?.birthDate ? data : null;
  } catch (err) {
    if (isBillingClass(err)) throw new IntakeStorageBillingError(err);
    throw err;
  }
}

export async function uploadUserIntake(uid: string, input: NatalChartInput): Promise<void> {
  try {
    await setDoc(intakeDoc(uid), input, { merge: true });
  } catch (err) {
    if (isBillingClass(err)) throw new IntakeStorageBillingError(err);
    throw err;
  }
}
