import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { accountFirestore } from '../platform/firebase';
import type { GazetteerEntry } from './gazetteer';
import type { IntakeDraft } from './onboarding';
import type { CurrentLocation } from './transits';
import { validateBirthDate } from './birthDate';

export const ONBOARDING_PROGRESS_PREFIX = 'natally.onboarding.v2:';
export const ONBOARDING_STEPS = ['name', 'date', 'place', 'time', 'currentPlace'] as const;
export type OnboardingStep = typeof ONBOARDING_STEPS[number];
export interface OnboardingAnswers {
 name: string; date: string; place: string; time: string; currentPlace: string;
}
export interface OnboardingProgress {
 version: 1;
 accountUid: string;
 mode: 'initial' | 'redo';
 status: 'draft' | 'submitted' | 'complete';
 answers: OnboardingAnswers;
 unknownTime: boolean;
 deviceLocation: CurrentLocation | null;
 skipLocation: boolean;
 completed: Record<OnboardingStep, boolean>;
}
export interface OnboardingLoadResult {
 progress: OnboardingProgress | null;
 error: string | null;
}

export function createOnboardingProgress(accountUid: string, mode: 'initial' | 'redo' = 'initial'): OnboardingProgress {
 if (!accountUid) throw new Error('Sign in before saving onboarding answers.');
 return {
  version: 1, accountUid, mode, status: 'draft',
  answers: { name: '', date: '', place: '', time: '', currentPlace: '' },
  unknownTime: false, deviceLocation: null, skipLocation: false,
  completed: { name: false, date: false, place: false, time: false, currentPlace: false },
 };
}

export function onboardingSectionValid(progress: OnboardingProgress, step: OnboardingStep, gazetteer: readonly GazetteerEntry[]): boolean {
 const normalize = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('en');
 const validLocation = (location: CurrentLocation | null) => {
  if (!location || typeof location.name !== 'string' || !location.name.trim() ||
      !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
      !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180 ||
      typeof location.timeZone !== 'string' || !location.timeZone) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: location.timeZone }); return true; }
  catch { return false; }
 };
 const selectedPlace = (value: string) => {
  const counts = new Map<string, number>();
  for (const entry of gazetteer) {
   const key = normalize(`${entry.name}, ${entry.countryCode}`);
   counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return gazetteer.some(entry => {
   const base = `${entry.name}, ${entry.countryCode}`;
   const label = (counts.get(normalize(base)) ?? 0) > 1 ? `${base} — ${entry.tzid}` : base;
   return normalize(label) === normalize(value) && validLocation({
    name: label, latitude: entry.lat, longitude: entry.lon, timeZone: entry.tzid,
   });
  });
 };
 if (step === 'name') return progress.answers.name.trim().length > 0;
 if (step === 'date') {
  const max = new Date(); max.setFullYear(max.getFullYear() + 1);
  return validateBirthDate(progress.answers.date, max.toISOString().slice(0, 10)).isoDate !== null;
 }
 if (step === 'place') return selectedPlace(progress.answers.place);
 if (step === 'time') return progress.unknownTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(progress.answers.time);
 return progress.skipLocation || validLocation(progress.deviceLocation) || selectedPlace(progress.answers.currentPlace);
}

export function normalizeOnboardingProgress(value: unknown, accountUid: string, gazetteer: readonly GazetteerEntry[]): OnboardingProgress | null {
 if (!accountUid || typeof value !== 'object' || value === null) return null;
 const raw = value as Record<string, unknown>;
 if (raw.version !== 1 || raw.accountUid !== accountUid || !['initial', 'redo'].includes(String(raw.mode))) return null;
 const result = createOnboardingProgress(accountUid, raw.mode as 'initial' | 'redo');
 const answers = typeof raw.answers === 'object' && raw.answers !== null ? raw.answers as Record<string, unknown> : {};
 for (const key of ONBOARDING_STEPS) result.answers[key] = typeof answers[key] === 'string' ? answers[key] : '';
 result.unknownTime = raw.unknownTime === true;
 result.skipLocation = raw.skipLocation === true;
 if (typeof raw.deviceLocation === 'object' && raw.deviceLocation !== null) {
  const location = raw.deviceLocation as CurrentLocation;
  const candidate = { ...result, skipLocation: false, answers: { ...result.answers, currentPlace: '' }, deviceLocation: location };
  if (onboardingSectionValid(candidate, 'currentPlace', gazetteer)) result.deviceLocation = {
   name: location.name, latitude: location.latitude, longitude: location.longitude, timeZone: location.timeZone,
  };
 }
 const completed = typeof raw.completed === 'object' && raw.completed !== null && !Array.isArray(raw.completed) ? raw.completed as Record<string, unknown> : {};
 for (const step of ONBOARDING_STEPS) {
  const savedInitialValue = result.mode === 'initial' && (step === 'date' || step === 'place');
  result.completed[step] = (completed[step] === true || savedInitialValue) && onboardingSectionValid(result, step, gazetteer);
 }
 if (firstMissingOnboardingStep(result, gazetteer) === ONBOARDING_STEPS.length && (raw.status === 'submitted' || raw.status === 'complete')) result.status = raw.status;
 return result;
}

export function firstMissingOnboardingStep(progress: OnboardingProgress, gazetteer: readonly GazetteerEntry[]): number {
 // Evaluate every flag before selecting the first missing section. The saved
 // computation status never authorizes re-asking an already completed question.
 const required: readonly OnboardingStep[] = progress.mode === 'initial'
  ? ['date', 'place']
  : ['name', 'date', 'place', 'time'];
 const missing = required.filter(step => progress.completed[step] !== true || !onboardingSectionValid(progress, step, gazetteer));
 return missing.length === 0 ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(missing[0]);
}

export function loadOnboardingProgress(accountUid: string, gazetteer: readonly GazetteerEntry[], storage?: Storage): OnboardingLoadResult {
 try {
  const raw = (storage ?? localStorage).getItem(ONBOARDING_PROGRESS_PREFIX + encodeURIComponent(accountUid));
  if (raw === null) return { progress: null, error: null };
  const parsed: unknown = JSON.parse(raw);
  const progress = normalizeOnboardingProgress(parsed, accountUid, gazetteer);
  if (!progress) return { progress: null, error: 'Your saved onboarding answers could not be restored. The saved record has been kept.' };
  const original = parsed as OnboardingProgress;
  const repaired = JSON.stringify(original.completed) !== JSON.stringify(progress.completed) ||
   ONBOARDING_STEPS.some(step => original.answers?.[step] !== progress.answers[step]) ||
   (original.deviceLocation != null && progress.deviceLocation === null);
  return { progress, error: repaired ? 'Some saved answers need attention. Your other completed sections have been kept.' : null };
 } catch {
  return { progress: null, error: 'Your saved onboarding answers could not be read. They have not been erased; changes may not survive reopening this page.' };
 }
}

export function saveOnboardingProgress(progress: OnboardingProgress, storage?: Storage): string | null {
 try {
  if (!progress.accountUid) throw new Error('Missing account');
  (storage ?? localStorage).setItem(ONBOARDING_PROGRESS_PREFIX + encodeURIComponent(progress.accountUid), JSON.stringify(progress));
  return null;
 } catch {
  return 'Your answers are kept on this page, but could not be saved. Keep this page open; reopening it may lose the latest changes.';
 }
}

export function intakeDraftFromProgress(progress: OnboardingProgress, gazetteer: readonly GazetteerEntry[]): IntakeDraft | null {
 if (firstMissingOnboardingStep(progress, gazetteer) !== ONBOARDING_STEPS.length) return null;
 const maxDate = new Date(); maxDate.setFullYear(maxDate.getFullYear() + 1);
 const date = validateBirthDate(progress.answers.date, maxDate.toISOString().slice(0, 10)).isoDate;
 if (!date) return null;
 const normalize = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('en');
 const counts = new Map<string, number>();
 for (const entry of gazetteer) {
  const key = normalize(`${entry.name}, ${entry.countryCode}`);
  counts.set(key, (counts.get(key) ?? 0) + 1);
 }
 const findPlace = (value: string) => gazetteer.find(entry => {
  const base = `${entry.name}, ${entry.countryCode}`;
  return normalize((counts.get(normalize(base)) ?? 0) > 1 ? `${base} — ${entry.tzid}` : base) === normalize(value);
 });
 const place = findPlace(progress.answers.place);
 if (!place) return null;
 const current = findPlace(progress.answers.currentPlace);
 return {
  name: progress.answers.name.trim(), date,
  time: progress.unknownTime || !onboardingSectionValid(progress, 'time', gazetteer) ? null : progress.answers.time,
  unknownTime: progress.unknownTime || !onboardingSectionValid(progress, 'time', gazetteer),
  placeId: place.id, readingStyle: 'plain',
  currentLocation: progress.skipLocation ? undefined : progress.deviceLocation ?? (current ? {
   name: progress.answers.currentPlace, latitude: current.lat, longitude: current.lon, timeZone: current.tzid,
  } : undefined),
 };
}

export function completeOnboardingProgress(progress: OnboardingProgress, storage?: Storage): string | null {
 return saveOnboardingProgress({ ...progress, status: 'complete' }, storage);
}

const firebaseOnboardingWrites = new Map<string, Promise<void>>();

function enqueueFirebaseOnboardingWrite(uid: string, write: () => Promise<void>): Promise<void> {
 const result = (firebaseOnboardingWrites.get(uid) ?? Promise.resolve()).then(write);
 const tail = result.then(() => undefined, () => undefined);
 firebaseOnboardingWrites.set(uid, tail);
 void tail.then(() => {
  if (firebaseOnboardingWrites.get(uid) === tail) firebaseOnboardingWrites.delete(uid);
 });
 return result;
}

function progressFromFirebaseIntake(value: unknown, uid: string, gazetteer: readonly GazetteerEntry[]): OnboardingProgress | null {
 if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
 const raw = value as Record<string, unknown>;
 const fields = ['name', 'birthDate', 'birthTime', 'birthTimeUnknown', 'placeName', 'latitude', 'longitude', 'currentLocationName', 'currentLatitude', 'currentLongitude', 'currentTimezoneId'];
 if (!fields.some(field => Object.prototype.hasOwnProperty.call(raw, field))) return null;
 const progress = createOnboardingProgress(uid);
 progress.answers.name = typeof raw.name === 'string' ? raw.name : '';
 progress.answers.date = typeof raw.birthDate === 'string' ? raw.birthDate : '';
 progress.answers.time = typeof raw.birthTime === 'string' ? raw.birthTime : '';
 progress.unknownTime = raw.birthTimeUnknown === true;
 const normalize = (text: string) => text.trim().normalize('NFC').toLocaleLowerCase('en');
 const labels = new Map<string, number>();
 for (const entry of gazetteer) {
  const base = normalize(entry.name + ', ' + entry.countryCode);
  labels.set(base, (labels.get(base) ?? 0) + 1);
 }
 const matches = gazetteer.filter(entry => {
  if (typeof raw.latitude === 'number' && typeof raw.longitude === 'number' &&
      Number.isFinite(raw.latitude) && Number.isFinite(raw.longitude)) {
   return Math.abs(entry.lat - raw.latitude) < 0.00001 && Math.abs(entry.lon - raw.longitude) < 0.00001;
  }
  if (typeof raw.placeName !== 'string') return false;
  const base = entry.name + ', ' + entry.countryCode;
  const label = (labels.get(normalize(base)) ?? 0) > 1 ? base + ' — ' + entry.tzid : base;
  return normalize(raw.placeName) === normalize(label) || normalize(raw.placeName) === normalize(entry.name);
 });
 if (matches.length === 1) {
  const entry = matches[0]!;
  const base = entry.name + ', ' + entry.countryCode;
  progress.answers.place = (labels.get(normalize(base)) ?? 0) > 1 ? base + ' — ' + entry.tzid : base;
 }
 if (typeof raw.currentLocationName === 'string' &&
     typeof raw.currentLatitude === 'number' && typeof raw.currentLongitude === 'number' &&
     typeof raw.currentTimezoneId === 'string') {
  const location = {
   name: raw.currentLocationName, latitude: raw.currentLatitude,
   longitude: raw.currentLongitude, timeZone: raw.currentTimezoneId,
  };
  const candidate = { ...progress, deviceLocation: location };
  if (onboardingSectionValid(candidate, 'currentPlace', gazetteer)) {
   progress.deviceLocation = location;
   progress.answers.currentPlace = location.name;
  }
 }
 for (const step of ONBOARDING_STEPS) progress.completed[step] = onboardingSectionValid(progress, step, gazetteer);
 return progress;
}

export async function loadFirebaseOnboardingProgress(uid: string, gazetteer: readonly GazetteerEntry[]): Promise<OnboardingLoadResult> {
 await firebaseOnboardingWrites.get(uid);
 const reference = doc(accountFirestore(uid), 'users', uid, 'private', 'intake');
 const snapshot = await getDocFromServer(reference);
 accountFirestore(uid);
 const data = snapshot.exists() ? snapshot.data() : null;
 if (data && Object.prototype.hasOwnProperty.call(data, 'onboardingProgress')) {
  const progress = normalizeOnboardingProgress(data.onboardingProgress, uid, gazetteer);
  if (progress) return { progress, error: null };
  return {
   progress: createOnboardingProgress(uid),
   error: 'Your saved onboarding record needs attention. Its stored data has been kept.',
  };
 }
 const legacy = progressFromFirebaseIntake(data, uid, gazetteer);
 if (legacy) return { progress: legacy, error: null };
 const cached = loadOnboardingProgress(uid, gazetteer);
 if (cached.progress) await saveFirebaseOnboardingProgress(cached.progress);
 return cached;
}

export function saveFirebaseOnboardingProgress(progress: OnboardingProgress): Promise<void> {
 return enqueueFirebaseOnboardingWrite(progress.accountUid, async () => {
  const reference = doc(accountFirestore(progress.accountUid), 'users', progress.accountUid, 'private', 'intake');
  await setDoc(reference, { onboardingProgress: progress }, { mergeFields: ['onboardingProgress'] });
 });
}

export function saveFirebaseOnboardingStep(progress: OnboardingProgress, step: OnboardingStep): Promise<void> {
 return enqueueFirebaseOnboardingWrite(progress.accountUid, async () => {
  const reference = doc(accountFirestore(progress.accountUid), 'users', progress.accountUid, 'private', 'intake');
  const fields = ['version', 'accountUid', 'mode', 'status', 'answers.' + step, 'completed.' + step];
  if (step === 'time') fields.push('unknownTime');
  if (step === 'currentPlace') fields.push('deviceLocation', 'skipLocation');
  await setDoc(reference, { onboardingProgress: progress }, {
   mergeFields: fields.map(field => 'onboardingProgress.' + field),
  });
 });
}

export function completeFirebaseOnboardingProgress(progress: OnboardingProgress): Promise<void> {
 return enqueueFirebaseOnboardingWrite(progress.accountUid, async () => {
  const reference = doc(accountFirestore(progress.accountUid), 'users', progress.accountUid, 'private', 'intake');
  await setDoc(reference, { onboardingProgress: { status: 'complete' } }, {
   mergeFields: ['onboardingProgress.status'],
  });
 });
}
