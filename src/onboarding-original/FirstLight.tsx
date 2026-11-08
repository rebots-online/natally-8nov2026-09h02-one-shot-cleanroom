import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { GazetteerEntry } from '../../services/gazetteer';
import type { IntakeDraft } from '../../services/onboarding';
import './first-light.css';
import { scheduleSupertonicPreload } from '../../services/supertonicTts';
import { requestCurrentLocation, type CurrentLocation } from '../../services/transits';
import { validateBirthDate } from '../../services/birthDate';
import { BirthDateFields } from './BirthDateFields';

export type { IntakeDraft };

export interface FirstLightProps {
  readonly gazetteer: readonly GazetteerEntry[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCreate: (draft: IntakeDraft) => void;
}

export const QUESTION_SEQUENCE = [
  { kind: 'name', prompt: 'What may I call you?', type: 'text', placeholder: 'your name…' },
  { kind: 'date', prompt: 'When were you born?', type: 'date', placeholder: '' },
  { kind: 'place', prompt: 'Where were you born?', type: 'text', placeholder: 'a city…' },
  { kind: 'time', prompt: 'What time were you born?', type: 'time', placeholder: '' },
  { kind: 'currentPlace', prompt: 'Where are you today?', type: 'text', placeholder: 'your current city…' },
] as const;

/** Upper bound mirrors the calendar: today + 1 year (expecting parents). */
const MAX_BIRTH_DATE = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
})();

const stars = Array.from({ length: 24 }, (_, index) => {
  const seed = (multiplier: number) => (Math.sin((index + 1) * multiplier) + 1) / 2;
  return {
    id: index,
    x: seed(127.1) * 100,
    y: seed(311.7) * 100,
    size: 1 + seed(73.3) * 2,
    duration: 8 + seed(19.9) * 12,
    delay: seed(53.1) * -8,
  };
});

const normalizePlaceLabel = (value: string) =>
  value.trim().normalize('NFC').toLocaleLowerCase('en');

/** U.4-TW: clean-room presentation; the composition still owns persistence. */
export function FirstLight({ gazetteer, busy, error, onCreate }: FirstLightProps) {
  useEffect(scheduleSupertonicPreload, []);
  const id = useId();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ name: '', date: '', place: '', time: '', currentPlace: '' });
  const [deviceLocation, setDeviceLocation] = useState<CurrentLocation | null>(null);
  const [skipLocation, setSkipLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [unknownTime, setUnknownTime] = useState(false);
  const [typed, setTyped] = useState({ step: -1, count: 0 });
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [selection, setSelection] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const timePickerRef = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composition = useRef(false);
  const advancing = useRef(false);
  const sent = useRef(false);
  const current = QUESTION_SEQUENCE[step] ?? QUESTION_SEQUENCE[0];
  const answer = answers[current.kind];
  const count = reducedMotion ? current.prompt.length : typed.step === step ? typed.count : 0;
  const promptDone = count >= current.prompt.length;
  const enabled = !busy && !submitted && !(current.kind === 'time' && unknownTime);
  const textInput = current.type === 'text';
  const placeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of gazetteer) {
      const base = normalizePlaceLabel(`${entry.name}, ${entry.countryCode}`);
      counts.set(base, (counts.get(base) ?? 0) + 1);
    }
    return gazetteer.map((entry) => {
      const base = `${entry.name}, ${entry.countryCode}`;
      return {
        entry,
        label: (counts.get(normalizePlaceLabel(base)) ?? 0) > 1 ? `${base} — ${entry.tzid}` : base,
      };
    });
  }, [gazetteer]);
  const match = placeOptions.find(
    (option) => normalizePlaceLabel(option.label) === normalizePlaceLabel(answers.place),
  );
  const currentMatch = placeOptions.find(option => normalizePlaceLabel(option.label) === normalizePlaceLabel(answers.currentPlace));
  const latLabel = (lat: number) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonLabel = (lon: number) => `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  const invalidPlace = current.kind === 'place' && answers.place.trim().length > 0 && !match;
  const birthDate = validateBirthDate(answers.date, MAX_BIRTH_DATE);
  const valid =
    current.kind === 'name'
      ? answer.trim().length > 0
      : current.kind === 'date'
        ? birthDate.isoDate !== null
        : current.kind === 'place'
          ? match !== undefined
          : current.kind === 'currentPlace'
            ? !locating && Boolean(currentMatch || deviceLocation || skipLocation)
              : unknownTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(answer);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    advancing.current = false;
    composition.current = false;
    setScroll(0);
    setTyped({ step, count: 0 });
    if (reducedMotion) return;
    let revealed = 0;
    const timer = window.setInterval(() => {
      revealed += 1;
      setTyped({ step, count: revealed });
      if (revealed >= current.prompt.length) window.clearInterval(timer);
    }, 55);
    return () => window.clearInterval(timer);
  }, [step, current.prompt, reducedMotion]);

  useEffect(() => {
    if (promptDone && enabled && input.current?.id === `first-light-${current.kind}`)
      input.current.focus();
  }, [promptDone, current.kind, enabled]);

  useEffect(() => {
    if (error && !busy) {
      sent.current = false;
      setSubmitted(false);
    }
  }, [busy, error]);

  const syncCaret = (field: HTMLInputElement) => {
    setSelection(field.selectionStart ?? field.value.length);
    setScroll(field.scrollLeft);
  };

  const advance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!promptDone && current.kind !== 'date') || !valid || busy || sent.current || composition.current || advancing.current)
      return;
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
      name: answers.name.trim(),
      date: birthDate.isoDate,
      time: unknownTime ? null : answers.time,
      unknownTime,
      placeId: match.entry.id,
      readingStyle: 'plain',
      currentLocation: skipLocation ? undefined : deviceLocation ?? (currentMatch ? {
        name: currentMatch.label, latitude: currentMatch.entry.lat,
        longitude: currentMatch.entry.lon, timeZone: currentMatch.entry.tzid,
      } : undefined),
    });
  };

  return (
    <section className="first-light" aria-label="First light">
      <div className="first-light__backdrop" aria-hidden="true">
        <div className="first-light__aura" />
        <svg
          className="first-light__veins"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          <title>Decorative gold veins</title>
          <defs>
            <path
              id={`${id}-vein`}
              d="M80 0 138 180 108 330 195 470 160 620 225 800 200 1000 M138 180 270 225 335 350 M108 330 35 425 0 560 M160 620 310 680 375 825 M1000 100 885 235 930 380 810 510 860 710 780 1000 M885 235 745 290 710 420 M810 510 680 560 615 720 M860 710 980 785 1000 900"
            />
            <filter id={`${id}-glow`}>
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          <use href={`#${id}-vein`} stroke="#E8A33D" strokeWidth="6" filter={`url(#${id}-glow)`} />
          <use href={`#${id}-vein`} stroke="#FFE08A" strokeWidth="1.8" />
        </svg>
        {stars.map((star) => (
          <span
            key={star.id}
            className="first-light__star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="first-light__content">
        <h1 className="first-light__prompt">
          <span className="first-light__sr">{current.prompt}</span>
          <span aria-hidden="true">
            {current.prompt.slice(0, count)}
            {!promptDone && <span className="first-light__caret" />}
          </span>
        </h1>
        {(promptDone || current.kind === 'date') && (
          <form
            className="first-light__form"
            onSubmit={advance}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.nativeEvent.isComposing ||
                  composition.current ||
                  event.repeat ||
                  event.nativeEvent.keyCode === 229)
              )
                event.preventDefault();
            }}
          >
            <div className="first-light__answer" data-picker={!textInput}>
              {current.kind === 'date' && (
                <BirthDateFields
                  value={answers.date}
                  onChange={date => setAnswers(previous => ({ ...previous, date }))}
                  disabled={!enabled}
                  describedBy={`${id}-birth-date-hint`}
                  invalid={birthDate.invalid}
                  maxDate={MAX_BIRTH_DATE}
                />
              )}
              {current.kind === 'time' && (
                <div className="first-light__typed">
                  <input
                    ref={input}
                    id={`first-light-${current.kind}`}
                    className="first-light__field"
                    aria-label={current.prompt}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="HHMM"
                    value={unknownTime ? '' : answers.time}
                    disabled={!enabled || unknownTime}
                    onChange={(event) => {
                      // Type 1617 → 16:17 — colon inserted as you type, so
                      // the bare numeric keypad is always sufficient.
                      const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
                      const masked =
                        digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
                      setAnswers({ ...answers, time: masked });
                    }}
                  />
                  <button
                    type="button"
                    className="first-light__calendar-toggle"
                    aria-label="Open clock time picker"
                    disabled={!enabled || unknownTime}
                    onClick={() => timePickerRef.current?.showPicker?.()}
                  >
                    🕒
                  </button>
                  {/* The original natally picker: a native type=time input
                      kept invisible; showPicker() raises the platform clock
                      (Android wheel / desktop clock-face). */}
                  <input
                    ref={timePickerRef}
                    type="time"
                    aria-hidden="true"
                    tabIndex={-1}
                    className="first-light__native-time"
                    value={answers.time}
                    min="00:00"
                    max="23:59"
                    disabled={!enabled || unknownTime}
                    onChange={(event) => setAnswers({ ...answers, time: event.currentTarget.value })}
                  />
                </div>
              )}
              {textInput && (
              <input
                key={current.kind}
                ref={input}
                id={`first-light-${current.kind}`}
                className="first-light__field"
                aria-label={current.prompt}
                aria-invalid={invalidPlace || undefined}
                aria-describedby={
                  current.kind === 'place'
                    ? match
                      ? `${id}-place-lock`
                      : invalidPlace
                        ? `${id}-place-error`
                        : undefined
                    : undefined
                }
                role={current.kind === 'place' ? 'combobox' : undefined}
                aria-autocomplete={current.kind === 'place' ? 'list' : undefined}
                type={current.type}
                value={answer}
                autoComplete="off"
                list={current.kind === 'place' || current.kind === 'currentPlace' ? `${id}-places` : undefined}
                disabled={!enabled}
                onChange={(event) => {
                  const field = event.currentTarget;
                  setAnswers({ ...answers, [current.kind]: field.value });
                  if (current.kind === 'currentPlace') { setDeviceLocation(null); setSkipLocation(false); }
                  syncCaret(field);
                }}
                onSelect={(event) => syncCaret(event.currentTarget)}
                onScroll={(event) => syncCaret(event.currentTarget)}
                onFocus={(event) => {
                  syncCaret(event.currentTarget);
                }}
                onCompositionStart={() => {
                  composition.current = true;
                }}
                onCompositionEnd={() => {
                  composition.current = false;
                }}
              />
              )}
              {textInput && (
                <div className="first-light__mirror" aria-hidden="true">
                  <span
                    className="first-light__mirror-text"
                    style={{ transform: `translateX(${-scroll}px)` }}
                  >
                    {answer ? (
                      <>
                        <span className="first-light__invisible">{answer.slice(0, selection)}</span>
                        {enabled && <span className="first-light__caret" />}
                        <span className="first-light__invisible">{answer.slice(selection)}</span>
                      </>
                    ) : (
                      <>
                        <span className="first-light__placeholder">{current.placeholder}</span>
                        {enabled && <span className="first-light__caret" />}
                      </>
                    )}
                  </span>
                </div>
              )}
            {current.kind === 'place' && (
              <>
                <datalist id={`${id}-places`}>
                  {placeOptions.map(({ entry, label }) => (
                    <option key={entry.id} value={label} />
                  ))}
                </datalist>
                {match ? (
                  <p id={`${id}-place-lock`} className="first-light__place-lock">
                    ◈ Ephemeris lock: {latLabel(match.entry.lat)} · {lonLabel(match.entry.lon)} ·{' '}
                    {match.entry.tzid}
                  </p>
                ) : invalidPlace ? (
                  <p id={`${id}-place-error`} className="first-light__field-error">
                    Choose a place from the suggestions to lock ephemeris coordinates.
                  </p>
                ) : (
                  <p className="first-light__place-lock first-light__place-lock--pending">
                    Type to search the gazetteer — coordinates lock on selection.
                  </p>
                )}
              </>
            )}
              {current.kind === 'time' && enabled && (
                <span className="first-light__picker-caret first-light__caret" aria-hidden="true" />
              )}
            </div>

            {current.kind === 'date' && (
              <p
                id={`${id}-birth-date-hint`}
                aria-live="polite"
                className={
                  birthDate.invalid
                    ? 'first-light__field-error'
                    : valid
                    ? 'first-light__place-lock'
                    : 'first-light__place-lock first-light__place-lock--pending'
                }
              >
                {birthDate.message}
              </p>
            )}
            {current.kind === 'time' && !unknownTime && (
              <p
                className={
                  valid
                    ? 'first-light__place-lock'
                    : 'first-light__place-lock first-light__place-lock--pending'
                }
              >
                {valid
                  ? `✓ ${answer} · ${
                      (() => {
                        const [h, m] = answer.split(':').map(Number);
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const h12 = h % 12 === 0 ? 12 : h % 12;
                        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
                      })()
                    } · local at the locked coordinates`
                  : 'Type 4 digits (1617 → 16:17), tap 🕒 for the clock, or tick “I don’t know my birth time”.'}
              </p>
            )}
            {current.kind === 'time' && (
              <label className="first-light__unknown">
                <input
                  type="checkbox"
                  checked={unknownTime}
                  disabled={busy || submitted}
                  onChange={(event) => setUnknownTime(event.target.checked)}
                />
                I don’t know my birth time
              </label>
            )}
            {current.kind === 'currentPlace' && (
              <div className="space-y-3 text-sm">
                <datalist id={`${id}-places`}>
                  {placeOptions.map(option => <option key={option.entry.id} value={option.label} />)}
                </datalist>
                <p>Today: {new Date().toLocaleString()} ({Intl.DateTimeFormat().resolvedOptions().timeZone}). The reading captures a fresh timestamp when generated.</p>
                <p>Choose a city, share approximate device location, or skip. Location is saved with your chart; the reading service receives the location label and calculated sky. No background tracking.</p>
                <button type="button" className="first-light__back" disabled={locating || busy || submitted}
                  onClick={async () => {
                    setLocating(true); setLocationError('');
                    try {
                      const location = await requestCurrentLocation();
                      setDeviceLocation(location); setSkipLocation(false);
                      setAnswers(previous => ({ ...previous, currentPlace: location.name }));
                    } catch (failure) { setLocationError(failure instanceof Error ? failure.message : 'Choose a city or skip.'); }
                    finally { setLocating(false); }
                  }}>{locating ? 'Finding your location…' : 'Use device location'}</button>
                <button type="button" className="first-light__back" disabled={locating || busy || submitted}
                  onClick={() => { setSkipLocation(true); setDeviceLocation(null); setAnswers(previous => ({ ...previous, currentPlace: '' })); }}>
                  Skip location
                </button>
                <p role="status">{locationError || (skipLocation ? 'Location skipped; the reading uses the global planetary sky.' : deviceLocation || currentMatch ? 'Current location selected.' : 'Select a city from the list.')}</p>
              </div>
            )}
            <div className="first-light__actions">
              {step > 0 && (
                <button
                  type="button"
                  className="first-light__back"
                  disabled={busy || submitted}
                  onClick={() => {
                    advancing.current = true;
                    if (QUESTION_SEQUENCE[step - 1].kind === 'date') flushSync(() => setStep(step - 1));
                    else setStep(step - 1);
                  }}
                >
                  Back
                </button>
              )}
              <button
                className="first-light__submit"
                type="submit"
                disabled={!valid || busy || submitted}
              >
                {busy || submitted
                  ? 'Drawing your sky…'
                  : step === QUESTION_SEQUENCE.length - 1
                    ? 'Begin'
                    : 'Next'}
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="first-light__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export default FirstLight;
