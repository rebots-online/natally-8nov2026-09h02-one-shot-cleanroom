import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GazetteerEntry } from '../services/gazetteer';
import type { IntakeDraft } from '../services/onboarding';
import { scheduleSupertonicPreload } from '../services/supertonicTts';
import { validateBirthDate } from '../services/birthDate';
import {
 firstMissingOnboardingStep, intakeDraftFromProgress, ONBOARDING_STEPS,
 onboardingSectionValid, type OnboardingProgress, type OnboardingStep,
} from '../services/onboardingProgress';
import { AtelierRail } from '../app/prototype/ImmersiveLayout';
import { BirthDateFields } from './BirthDateFields';
import './first-light.css';

export type { IntakeDraft };

export interface FirstLightProps {
 readonly gazetteer: readonly GazetteerEntry[];
 readonly busy: boolean;
 readonly error: string | null;
 readonly onCreate: (draft: IntakeDraft) => void;
 readonly onBack?: () => void;
 readonly initialProgress?: OnboardingProgress;
 readonly onProgress?: (progress: OnboardingProgress) => void;
 readonly onAccept?: (progress: OnboardingProgress, step: OnboardingStep) => Promise<void>;
}

export const QUESTION_SEQUENCE = [
 { kind: 'name', prompt: 'What should I call you?', type: 'text' },
 { kind: 'date', prompt: 'When were you born?', type: 'date' },
 { kind: 'place', prompt: 'Where were you born?', type: 'text' },
 { kind: 'time', prompt: 'What time were you born?', type: 'time' },
] as const;

const MAX_BIRTH_DATE = (() => {
 const date = new Date();
 date.setFullYear(date.getFullYear() + 1);
 return date.toISOString().slice(0, 10);
})();
const normalizePlaceLabel = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('en');

export function FirstLight({
 gazetteer, busy, error, onCreate, onBack, initialProgress, onProgress, onAccept,
}: FirstLightProps) {
 useEffect(scheduleSupertonicPreload, []);
 const id = useId();
 const [snapshot, setSnapshot] = useState<OnboardingProgress | null>(initialProgress ?? null);
 const progress = useRef(snapshot);
 const [step, setStep] = useState(() => initialProgress ? firstMissingOnboardingStep(initialProgress, gazetteer) : 0);
 const questions = useRef(QUESTION_SEQUENCE.filter(question => initialProgress &&
  (initialProgress.mode === 'redo' || question.kind === 'date' || question.kind === 'place') &&
  (initialProgress.completed[question.kind] !== true || !onboardingSectionValid(initialProgress, question.kind, gazetteer))));
 const [submitted, setSubmitted] = useState(false);
 const [saving, setSaving] = useState(false);
 const [saveError, setSaveError] = useState<string | null>(null);
 const timePickerRef = useRef<HTMLInputElement>(null);
 const input = useRef<HTMLInputElement>(null);
 const composition = useRef(false);
 const advancing = useRef(false);
 const sent = useRef(false);
 const alive = useRef(true);
 const epoch = useRef(0);
 const current = QUESTION_SEQUENCE[step] ?? QUESTION_SEQUENCE[0];
 const answers = snapshot?.answers ?? { name: '', date: '', place: '', time: '', currentPlace: '' };
 const unknownTime = snapshot?.unknownTime ?? false;
 const enabled = !busy && !submitted && !saving && !(current.kind === 'time' && unknownTime);
 const placeOptions = useMemo(() => {
  const counts = new Map<string, number>();
  for (const entry of gazetteer) {
   const base = normalizePlaceLabel(entry.name + ', ' + entry.countryCode);
   counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return gazetteer.map(entry => {
   const base = entry.name + ', ' + entry.countryCode;
   return { entry, label: (counts.get(normalizePlaceLabel(base)) ?? 0) > 1 ? base + ' — ' + entry.tzid : base };
  });
 }, [gazetteer]);
 const match = placeOptions.find(option => normalizePlaceLabel(option.label) === normalizePlaceLabel(answers.place));
 const latLabel = (lat: number) => Math.abs(lat).toFixed(2) + '° ' + (lat >= 0 ? 'N' : 'S');
 const lonLabel = (lon: number) => Math.abs(lon).toFixed(2) + '° ' + (lon >= 0 ? 'E' : 'W');
 const invalidPlace = current.kind === 'place' && answers.place.trim().length > 0 && !match;
 const birthDate = validateBirthDate(answers.date, MAX_BIRTH_DATE);
 const valid = snapshot !== null && onboardingSectionValid(snapshot, current.kind, gazetteer);
 const finalQuestion = snapshot !== null && firstMissingOnboardingStep({
  ...snapshot, completed: { ...snapshot.completed, [current.kind]: true },
 }, gazetteer) === ONBOARDING_STEPS.length;
 const questionIndex = questions.current.findIndex(question => question.kind === current.kind);

 useEffect(() => {
  alive.current = true;
  return () => { alive.current = false; epoch.current += 1; };
 }, []);
 useEffect(() => {
  composition.current = false;
 }, [step]);
 useEffect(() => {
  if (enabled && input.current?.id === 'first-light-' + current.kind) input.current.focus();
 }, [current.kind, enabled, Boolean(match)]);
 useEffect(() => {
  if (error && !busy) { sent.current = false; setSubmitted(false); }
 }, [busy, error]);

 const report = (next: OnboardingProgress) => {
  if (!alive.current) return;
  progress.current = next;
  setSnapshot(next);
  onProgress?.(next);
 };
 const updateAnswer = (kind: OnboardingStep, value: string) => {
  if (!progress.current || busy || saving || submitted || advancing.current) return;
  report({
   ...progress.current, status: 'draft',
   answers: { ...progress.current.answers, [kind]: value },
   completed: { ...progress.current.completed, [kind]: false },
  });
 };
 const updateUnknownTime = (value: boolean) => {
  if (!progress.current || busy || saving || submitted || advancing.current) return;
  report({ ...progress.current, status: 'draft', unknownTime: value,
   completed: { ...progress.current.completed, time: false } });
 };

 const advance = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!progress.current || !valid || busy || saving || sent.current || composition.current || advancing.current) return;
  if (!event.currentTarget.checkValidity()) return;
  const candidate = {
   ...progress.current,
   completed: { ...progress.current.completed, [current.kind]: true },
  };
  const generation = epoch.current;
  advancing.current = true;
  setSaving(true);
  setSaveError(null);
  try {
   if (!onAccept) throw new Error('Your answers could not be saved. Please try again.');
   await onAccept(candidate, current.kind);
   if (!alive.current || generation !== epoch.current) return;
   report(candidate);
   const missing = firstMissingOnboardingStep(candidate, gazetteer);
   if (missing < ONBOARDING_STEPS.length) {
    setStep(missing);
   } else {
    const draft = intakeDraftFromProgress(candidate, gazetteer);
    if (!draft) throw new Error('Your saved birth details could not be read.');
    sent.current = true;
    setSubmitted(true);
    onCreate(draft);
   }
  } catch (failure) {
   if (alive.current && generation === epoch.current) {
    setSaveError(failure instanceof Error ? failure.message : 'Your answers could not be saved. Please try again.');
   }
  } finally {
   if (alive.current && generation === epoch.current) {
    advancing.current = false;
    setSaving(false);
   }
  }
 };
 const back = () => {
  if (busy || submitted || saving || advancing.current) return;
  if (questionIndex <= 0) { onBack?.(); return; }
  const previous = questions.current[questionIndex - 1]!;
  setStep(QUESTION_SEQUENCE.findIndex(question => question.kind === previous.kind));
 };
 if (!snapshot || step === ONBOARDING_STEPS.length) return null;

  return (
    <section className="first-light" aria-labelledby={`${id}-question`} aria-busy={busy || saving}>
      <AtelierRail title={current.prompt} labelledBy={`${id}-question`} onBack={questionIndex > 0 || onBack ? back : undefined}>
        <p className="atelier-secondary-text atelier-step-label">{questionIndex + 1} of {questions.current.length}</p>
        {(saveError || error) && <div className="atelier-status-banner error" role="alert">{saveError ?? error}</div>}
        <form onSubmit={advance} onKeyDown={event => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || composition.current || event.repeat || event.nativeEvent.keyCode === 229)) event.preventDefault();
        }}>
          {current.kind === 'name' && <div className="atelier-field-group">
            <label className="atelier-label" htmlFor="first-light-name">Name</label>
            <input className="atelier-input" ref={input} id="first-light-name" type="text" autoComplete="given-name" required value={answers.name} disabled={!enabled}
              onChange={event => updateAnswer('name', event.target.value)}
              onCompositionStart={() => { composition.current = true; }} onCompositionEnd={() => { composition.current = false; }} />
            <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
          </div>}
          {current.kind === 'date' && <BirthDateFields value={answers.date}
            onChange={date => updateAnswer('date', date)}
            disabled={!enabled} describedBy={`${id}-birth-date-hint`} invalid={birthDate.invalid} maxDate={MAX_BIRTH_DATE} />}
          {current.kind === 'place' && <>
            {match ? <div className="atelier-place-chip" data-bind="confirmed-place">
              <div>
                <span className="atelier-place-label" data-bind="place-label">{match.label}</span>
                <span className="atelier-place-coordinate" data-bind="place-coordinates">{latLabel(match.entry.lat)} · {lonLabel(match.entry.lon)}</span>
                <span className="atelier-place-zone" data-bind="place-timezone">{match.entry.tzid}</span>
              </div>
              <button type="button" className="atelier-rail-btn-icon" aria-label="Change birthplace" disabled={!enabled} onClick={() => updateAnswer('place', '')}>×</button>
            </div> : <>
              <div className="atelier-field-group">
                <label className="atelier-label" htmlFor="first-light-place">Birthplace search</label>
                <input className="atelier-input" ref={input} id="first-light-place" type="text" autoComplete="off" list={`${id}-places`} role="combobox" aria-autocomplete="list"
                  aria-invalid={invalidPlace || undefined} aria-describedby={invalidPlace ? `${id}-place-error` : undefined}
                  value={answers.place} disabled={!enabled}
                  onChange={event => updateAnswer('place', event.target.value)}
                  onCompositionStart={() => { composition.current = true; }} onCompositionEnd={() => { composition.current = false; }} />
                <div id={`${id}-place-error`} className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!invalidPlace}>
                  {invalidPlace ? 'Choose a place from the suggestions to lock ephemeris coordinates.' : ''}
                </div>
              </div>
              <datalist id={`${id}-places`} data-bind="place-suggestions">
                {placeOptions.map(({ entry, label }) => <option key={entry.id} data-bind="place-suggestion" value={label} />)}
              </datalist>
            </>}
          </>}
          {current.kind === 'time' && <>
            <div className="atelier-field-group">
              <label className="atelier-label" htmlFor="first-light-time">Birth time</label>
              <input className="atelier-input" ref={input} id="first-light-time" type="text" inputMode="numeric" placeholder={unknownTime ? undefined : 'HHMM'} maxLength={5} autoComplete="off"
                value={unknownTime ? '' : answers.time} disabled={!enabled || unknownTime}
                onChange={event => {
                  const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
                  updateAnswer('time', digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits);
                }} />
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
            </div>
            {!unknownTime && <button type="button" className="atelier-btn-secondary" data-action="time-picker" disabled={!enabled} onClick={() => timePickerRef.current?.showPicker?.()}>Choose time</button>}
            <input ref={timePickerRef} type="time" aria-hidden="true" tabIndex={-1} className="first-light__native-time" value={answers.time} min="00:00" max="23:59" disabled={!enabled || unknownTime}
              onChange={event => updateAnswer('time', event.currentTarget.value)} />
            <label className="atelier-checkbox-label">
              <input type="checkbox" checked={unknownTime} data-action="unknown-time" disabled={busy || submitted || saving} onChange={event => updateUnknownTime(event.target.checked)} />I don’t know
            </label>
          </>}
          <button type="submit" className="atelier-btn-primary" data-action={finalQuestion ? 'calculate-chart' : undefined} disabled={!valid || busy || submitted || saving}>
            {saving ? 'Saving…' : finalQuestion ? 'Cast my chart' : 'Continue'}
          </button>
        </form>
      </AtelierRail>
    </section>
  );
}

export default FirstLight;
