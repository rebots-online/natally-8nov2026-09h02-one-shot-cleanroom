import { useEffect, useRef, useState } from 'react';
import { formatBirthDateInput, getBirthDateParts, getBirthMonthDays, validateBirthDate } from '../services/birthDate';

export function BirthDateFields({ value, onChange, disabled, describedBy, invalid, maxDate }: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  describedBy: string;
  invalid: boolean;
  maxDate: string;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);
  const parts = getBirthDateParts(value);
  const validation = validateBirthDate(value, maxDate);
  useEffect(() => { if (!disabled) fieldRef.current?.focus(); }, [disabled]);
  const maxYear = Number(maxDate.slice(0, 4));
  const [view, setView] = useState(() => ({
    year: /^\d{4}$/.test(parts.year) && Number(parts.year) >= 1925 && Number(parts.year) <= maxYear
      ? Number(parts.year) : Math.min(new Date().getFullYear(), maxYear),
    month: Number(parts.month) >= 1 && Number(parts.month) <= 12 ? Number(parts.month) : new Date().getMonth() + 1,
  }));
  const [choosingYear, setChoosingYear] = useState(false);
  const [yearDraft, setYearDraft] = useState(String(view.year));
  useEffect(() => {
    if (parts.year.length === 4 && Number(parts.year) >= 1925 && Number(parts.year) <= maxYear) {
      setView(previous => ({
        year: Number(parts.year),
        month: Number(parts.month) >= 1 && Number(parts.month) <= 12 ? Number(parts.month) : previous.month,
      }));
      setYearDraft(parts.year);
    }
  }, [parts.year, parts.month, maxYear]);
  const selectYear = (year: number) => {
    setView(previous => ({ ...previous, year }));
    setYearDraft(String(year));
    setChoosingYear(false);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(Date.UTC(view.year, view.month - 1 + offset, 1));
    setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 });
    setYearDraft(String(next.getUTCFullYear()));
  };
  const prefix = `${view.year}-${String(view.month).padStart(2, '0')}`;
  const firstWeekday = new Date(`${prefix}-01T12:00:00Z`).getUTCDay();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <>
      <div className="atelier-field-group">
        <label className="atelier-label" htmlFor={`${describedBy}-input`}>Birth date — year, month, day</label>
        <input className="atelier-input" id={`${describedBy}-input`} ref={fieldRef}
          type="text" inputMode="numeric" autoComplete="bday" placeholder="YYYY/MM/DD" required
          value={value} disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          onChange={event => onChange(formatBirthDateInput(event.currentTarget.value, value))} />
        <div id={describedBy} className="atelier-inline-error" data-bind="field-error" role="alert" hidden={!invalid}>{invalid ? validation.message : ''}</div>
      </div>
      <fieldset className="atelier-calendar" disabled={disabled}>
        <legend>Or choose your date</legend>
        <div className="atelier-calendar-head">
          <button type="button" aria-label="Previous month" data-action="calendar-prev" disabled={view.year === 1925 && view.month === 1} onClick={() => moveMonth(-1)}>‹</button>
          <select aria-label="Calendar month" data-bind="calendar-month" value={view.month} onChange={event => setView({ ...view, month: Number(event.currentTarget.value) })}>
            {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <button type="button" aria-label="Choose year" data-action="calendar-year" aria-expanded={choosingYear} onClick={() => { setYearDraft(String(view.year)); setChoosingYear(!choosingYear); }}><span data-bind="calendar-year">{view.year}</span> ▾</button>
          <button type="button" aria-label="Next month" data-action="calendar-next" disabled={view.year === maxYear && view.month >= Number(maxDate.slice(5, 7))} onClick={() => moveMonth(1)}>›</button>
        </div>
        {choosingYear ? <>
          <div className="atelier-field-group">
            <label className="atelier-label" htmlFor={`${describedBy}-year`}>Type a year</label>
            <input className="atelier-input" id={`${describedBy}-year`} type="text" inputMode="numeric" maxLength={4} autoFocus value={yearDraft} onChange={event => {
              const draft = event.currentTarget.value.replace(/\D/g, '').slice(0, 4);
              setYearDraft(draft);
              if (draft.length === 4 && Number(draft) >= 1925 && Number(draft) <= maxYear) selectYear(Number(draft));
            }} />
            <div className="atelier-inline-error" data-bind="field-error" role="alert" hidden />
          </div>
          <div className="atelier-calendar-years" aria-label="Choose a year">
            {Array.from({ length: maxYear - 1925 + 1 }, (_, index) => maxYear - index).map(year => <button type="button" key={year} data-action="calendar-pick-year" aria-pressed={year === view.year} onClick={() => selectYear(year)}>{year}</button>)}
          </div>
        </> : <div className="atelier-calendar-days" data-bind="calendar-days" aria-label={`${months[view.month - 1]} ${view.year}`}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(weekday => <span key={weekday} aria-hidden="true">{weekday}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
          {Array.from({ length: getBirthMonthDays(view.year, view.month) }, (_, index) => index + 1).map(day => {
            const date = `${prefix}-${String(day).padStart(2, '0')}`;
            return <button type="button" key={date} data-action="calendar-pick-day" aria-label={`${day} ${months[view.month - 1]} ${view.year}`} aria-pressed={value.replaceAll('/', '-') === date} disabled={date > maxDate} onClick={() => onChange(date.replaceAll('-', '/'))}>{day}</button>;
          })}
        </div>}
      </fieldset>
    </>
  );
}
