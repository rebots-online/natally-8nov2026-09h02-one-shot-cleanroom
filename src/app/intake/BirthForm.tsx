// Birth intake for casting a natal chart (DOCS/ARCHITECTURE.md §Surfaces).
// Place entry is a debounced gazetteer search: searchPlace() suggestions
// surface under the field as you type; confirming one pins a resolved chip
// carrying the place's IANA timezone (the chart uses it for wall-clock →
// UTC). Submitting runs natalChart() with a truthful computing state and a
// truthful error state — never a fabricated chart.

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { natalChart } from '../../astro/chart';
import { searchPlace } from '../../astro/gazetteer';
import type { BirthInput, GeoPlace, NatalChart } from '../../shared/types';

const MIN_QUERY_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 350;
const MAX_SUGGESTIONS = 6;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

interface BirthFormProps {
  onChart: (chart: NatalChart) => void;
}

export default function BirthForm({ onChart }: BirthFormProps) {
  const [name, setName] = useState('');
  const [dateIso, setDateIso] = useState('');
  const [timeIso, setTimeIso] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [suggestions, setSuggestions] = useState<GeoPlace[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const placeInputRef = useRef<HTMLInputElement | null>(null);

  // Debounced search over the raw query — never over the confirmed label the
  // input holds after a pick. searchPlace is pure and synchronous over the
  // vendored gazetteer; the debounce only paces it.
  useEffect(() => {
    if (place !== null) return;
    const query = placeQuery.trim();
    if (query.length < MIN_QUERY_CHARS) {
      setSuggestions([]);
      setActiveIndex(-1);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      setSuggestions(searchPlace(query).slice(0, MAX_SUGGESTIONS));
      setActiveIndex(-1);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [placeQuery, place]);

  function confirmPlace(pick: GeoPlace) {
    setPlace(pick);
    setPlaceQuery(pick.label);
    setSuggestions([]);
    setActiveIndex(-1);
    setSearching(false);
  }

  function clearPlace() {
    setPlace(null);
    setPlaceQuery('');
    setSuggestions([]);
    setActiveIndex(-1);
    placeInputRef.current?.focus();
  }

  // Editing the text of a confirmed place drops the chip and resumes search.
  function onPlaceChange(value: string) {
    setPlaceQuery(value);
    if (place !== null && value !== place.label) setPlace(null);
  }

  function onPlaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const pick = suggestions[activeIndex];
      if (pick) confirmPlace(pick);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (computing) return;
    setChartError(null);
    if (!DATE_RE.test(dateIso)) {
      setFieldError('Enter your birth date.');
      return;
    }
    if (timeIso !== '' && !TIME_RE.test(timeIso)) {
      setFieldError('Enter the birth time as a clock time, or leave it blank.');
      return;
    }
    if (place === null) {
      setFieldError('Search for your birth place and confirm one of the suggestions.');
      return;
    }
    setFieldError(null);
    const input: BirthInput = {
      ...(name.trim() !== '' ? { name: name.trim() } : {}),
      dateIso,
      timeIso: TIME_RE.test(timeIso) ? timeIso : null,
      place,
    };
    setComputing(true);
    try {
      onChart(await natalChart(input));
    } catch (error) {
      setComputing(false);
      setChartError(
        error instanceof Error
          ? error.message
          : 'The chart could not be computed. Please try again.',
      );
    }
  }

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  const listOpen = suggestions.length > 0;
  const queryTrimmed = placeQuery.trim();
  const noMatch =
    !place && !searching && !listOpen && queryTrimmed.length >= MIN_QUERY_CHARS;

  return (
    <div className="app-intake">
      <form className="card" onSubmit={submit} noValidate>
        <h1>Cast your chart</h1>
        <p className="card-intro">
          A few details and Natally will read the sky you arrived under, right here in the
          atelier.
        </p>

        <div className="field">
          <label htmlFor="birth-name">Name (optional)</label>
          <input
            id="birth-name"
            type="text"
            value={name}
            maxLength={60}
            autoComplete="off"
            placeholder="What Natally may call you"
            disabled={computing}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="birth-date">Birth date</label>
            <input
              id="birth-date"
              type="date"
              value={dateIso}
              max={todayIso}
              disabled={computing}
              onChange={e => setDateIso(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="birth-time">Birth time (optional)</label>
            <input
              id="birth-time"
              type="time"
              value={timeIso}
              disabled={computing}
              onChange={e => setTimeIso(e.target.value)}
            />
          </div>
        </div>
        <p className="hint">Leave the time blank if you don’t know it — the chart still casts.</p>

        <div className="field">
          <label htmlFor="birth-place">Birth place</label>
          <input
            id="birth-place"
            ref={placeInputRef}
            type="text"
            value={placeQuery}
            autoComplete="off"
            placeholder="Start typing a city — at least 3 characters"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls="birth-place-options"
            aria-autocomplete="list"
            aria-describedby="birth-place-note"
            disabled={computing}
            onChange={e => onPlaceChange(e.target.value)}
            onKeyDown={onPlaceKeyDown}
          />
          {listOpen && (
            <ul
              className="suggestions"
              id="birth-place-options"
              role="listbox"
              aria-label="Place suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.label}|${suggestion.latitude},${suggestion.longitude}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    className="suggest-option"
                    tabIndex={-1}
                    onClick={() => confirmPlace(suggestion)}
                  >
                    <span className="suggest-name">{suggestion.label}</span>
                    <span className="suggest-tz">{suggestion.timezoneIana}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {place !== null ? (
            <div className="chip" role="status">
              <span className="chip-main">{place.label}</span>
              <span className="chip-tz">{place.timezoneIana}</span>
              <button
                type="button"
                className="chip-x"
                aria-label="Clear place"
                disabled={computing}
                onClick={clearPlace}
              >
                ×
              </button>
            </div>
          ) : (
            <p className="hint" id="birth-place-note" role="status">
              {searching
                ? 'Searching places…'
                : noMatch
                  ? `No place matches “${queryTrimmed}” — try another spelling or a larger city nearby.`
                  : 'Pick a suggestion to confirm the place and its timezone.'}
            </p>
          )}
        </div>

        {fieldError && (
          <p className="note error" role="alert">
            {fieldError}
          </p>
        )}
        {computing && (
          <p className="note status" role="status">
            Casting your chart — computing planetary positions with the Swiss Ephemeris…
          </p>
        )}
        {chartError && (
          <p className="note error" role="alert">
            {chartError}
          </p>
        )}

        <button type="submit" className="btn primary wide" disabled={computing}>
          {computing ? 'Casting…' : 'Cast my chart'}
        </button>
      </form>
    </div>
  );
}
