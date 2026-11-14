import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { GazetteerEntry } from '../services/gazetteer';
import type { IntakeDraft } from '../services/onboarding';
import { scheduleSupertonicPreload } from '../services/supertonicTts';
import { validateBirthDate } from '../services/birthDate';
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
}

export const QUESTION_SEQUENCE = [
  { kind: 'name', prompt: 'What should I call you?', type: 'text' },
  { kind: 'date', prompt: 'When were you born?', type: 'date' },
  { kind: 'place', prompt: 'Where were you born?', type: 'text' },
  { kind: 'time', prompt: 'What time were you born?', type: 'time' },
] as const;

/** Existing calendar upper bound: today + one year. */
const MAX_BIRTH_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
})();

const normalizePlaceLabel = (value: string) =>
  value.trim().normalize('NFC').toLocaleLowerCase('en');

/** Frozen S04 templates, with the existing validated intake callbacks. */
export function FirstLight({ gazetteer, busy, error, onCreate, onBack }: FirstLightProps) {
  useEffect(scheduleSupertonicPreload, []);
  const id = useId();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ name: '', date: '', place: '', time: '' });
  const [unknownTime, setUnknownTime] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const timePickerRef = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composition = useRef(false);
  const advancing = useRef(false);
  const sent = useRef(false);
  const current = QUESTION_SEQUENCE[step] ?? QUESTION_SEQUENCE[0];
  const answer = answers[current.kind];
  const enabled = !busy && !submitted && !(current.kind === 'time' && unknownTime);
  const placeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of gazetteer) {
      const base = normalizePlaceLabel(`${entry.name}, ${entry.countryCode}`);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    return gazetteer.map(entry => {
      const base = `${entry.name}, ${entry.countryCode}`;
      return { entry, label: (counts.get(normalizePlaceLabel(base)) ?? 0) > 1 ? `${base} — ${entry.tzid}` : base };
    });
  }, [gazetteer]);
  const match = placeOptions.find(option => normalizePlaceLabel(option.label) === normalizePlaceLabel(answers.place));
  const latLabel = (lat: number) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonLabel = (lon: number) => `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
  const invalidPlace = current.kind === 'place' && answers.place.trim().length > 0 && !match;
  const birthDate = validateBirthDate(answers.date, MAX_BIRTH_DATE);
  const valid = current.kind === 'name' ? answer.trim().length > 0
    : current.kind === 'date' ? birthDate.isoDate !== null
      : current.kind === 'place' ? match !== undefined
        : unknownTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(answer);

  useEffect(() => {
    advancing.current = false;
    composition.current = false;
  }, [step]);
  useEffect(() => {
    if (enabled && input.current?.id === `first-light-${current.kind}`) input.current.focus();
  }, [current.kind, enabled, Boolean(match)]);
  useEffect(() => {
    if (error && !busy) { sent.current = false; setSubmitted(false); }
  }, [busy, error]);

  const advance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || busy || sent.current || composition.current || advancing.current) return;
    if (!event.currentTarget.checkValidity()) return;
    if (step < QUESTION_SEQUENCE.length - 1) {
      advancing.current = true;
      if (QUESTION_SEQUENCE[step + 1].kind === 'date') flushSync(() => setStep(step + 1));
      else setStep(step + 1);
      return;
    }
    if (!match || !birthDate.isoDate) return;
    sent.current = true;
    setSubmitted(true);
    onCreate({
      name: answers.name.trim(), date: birthDate.isoDate,
      time: unknownTime ? null : answers.time, unknownTime,
      placeId: match.entry.id, readingStyle: 'plain',
    });
  };
  const back = () => {
    if (busy || submitted) return;
    if (step === 0) { onBack?.(); return; }
    advancing.current = true;
    if (QUESTION_SEQUENCE[step - 1].kind === 'date') flushSync(() => setStep(step - 1));
    else setStep(step - 1);
  };

  return (
    <section className="first-light" aria-labelledby={`${id}-question`} aria-busy={busy}>
      <AtelierRail title={current.prompt} labelledBy={`${id}-question`} onBack={back}>
        <p className="atelier-secondary-text atelier-step-label">{step + 1} of 4</p>
        <form onSubmit={advance} onKeyDown={event => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || composition.current || event.repeat || event.nativeEvent.keyCode === 229)) event.preventDefault();
        }}>
          {current.kind === 'name' && <div className="atelier-field-group">
            <label className="atelier-label" htmlFor="first-light-name">Name</label>
            <input className="atelier-input" ref={input} id="first-light-name" type="text" autoComplete="given-name" required value={answers.name} disabled={!enabled}
              onChange={event => setAnswers({ ...answers, name: event.target.value })}
              onCompositionStart={() => { composition.current = true; }} onCompositionEnd={() => { composition.current = false; }} />
            <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
          </div>}
          {current.kind === 'date' && <BirthDateFields value={answers.date}
            onChange={date => setAnswers(previous => ({ ...previous, date }))}
            disabled={!enabled} describedBy={`${id}-birth-date-hint`} invalid={birthDate.invalid} maxDate={MAX_BIRTH_DATE} />}
          {current.kind === 'place' && <>
            {match ? <div className="atelier-place-chip" data-bind="confirmed-place">
              <div>
                <span className="atelier-place-label" data-bind="place-label">{match.label}</span>
                <span className="atelier-place-coordinate" data-bind="place-coordinates">{latLabel(match.entry.lat)} · {lonLabel(match.entry.lon)}</span>
                <span className="atelier-place-zone" data-bind="place-timezone">{match.entry.tzid}</span>
              </div>
              <button type="button" className="atelier-rail-btn-icon" aria-label="Change birthplace" disabled={!enabled} onClick={() => setAnswers({ ...answers, place: '' })}>×</button>
            </div> : <>
              <div className="atelier-field-group">
                <label className="atelier-label" htmlFor="first-light-place">Birthplace search</label>
                <input className="atelier-input" ref={input} id="first-light-place" type="text" autoComplete="off" list={`${id}-places`} role="combobox" aria-autocomplete="list"
                  aria-invalid={invalidPlace || undefined} aria-describedby={invalidPlace ? `${id}-place-error` : undefined}
                  value={answers.place} disabled={!enabled}
                  onChange={event => setAnswers({ ...answers, place: event.target.value })}
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
                  setAnswers({ ...answers, time: digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits });
                }} />
              <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
            </div>
            {!unknownTime && <button type="button" className="atelier-btn-secondary" data-action="time-picker" disabled={!enabled} onClick={() => timePickerRef.current?.showPicker?.()}>Choose time</button>}
            <input ref={timePickerRef} type="time" aria-hidden="true" tabIndex={-1} className="first-light__native-time" value={answers.time} min="00:00" max="23:59" disabled={!enabled || unknownTime}
              onChange={event => setAnswers({ ...answers, time: event.currentTarget.value })} />
            <label className="atelier-checkbox-label">
              <input type="checkbox" checked={unknownTime} data-action="unknown-time" disabled={busy || submitted} onChange={event => setUnknownTime(event.target.checked)} />I don’t know
            </label>
          </>}
          <button type="submit" className="atelier-btn-primary" data-action={current.kind === 'time' ? 'calculate-chart' : undefined} disabled={!valid || busy || submitted}>
            {step === QUESTION_SEQUENCE.length - 1 ? 'Cast my chart' : 'Continue'}
          </button>
        </form>
      </AtelierRail>
    </section>
  );
}

export default FirstLight;
