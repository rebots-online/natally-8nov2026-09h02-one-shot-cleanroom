import { useMemo, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarPickerProps {
  /** Current ISO value "YYYY-MM-DD" or '' — anchors the visible month. */
  readonly value: string;
  readonly min: string;
  readonly max: string;
  readonly onPick: (iso: string) => void;
  readonly onClose: () => void;
}

/** Upper bound: one year past today — expecting parents may cast ahead. */
const maxYearDyn = new Date().getFullYear() + 1;

const toIso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Custom calendar popover: renders identically on desktop Chrome and Android
 * browsers (native date inputs are unreliable there) and its format is ours.
 */
export function CalendarPicker({ value, min, max, onPick, onClose }: CalendarPickerProps) {
  // Untouched state opens mid-window (operator pick: 1990), never the floor.
  const [y0, m0] = (value || '1990-06-01').split('-').map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState((m0 || 1) - 1);
  // Wheel semantics: tapping the header swaps the grid for a list to pick
  // from — a picker must never require typing.
  const [listMode, setListMode] = useState<'days' | 'months' | 'years'>('days');

  const grid = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push({ iso: toIso(viewYear, viewMonth, d), day: d });
    return cells;
  }, [viewYear, viewMonth]);

  const stepByYears = (delta: number) => {
    const yy = viewYear + delta;
    if (yy >= 1925 && yy <= maxYearDyn) setViewYear(yy);
  };

  const step = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    if (`${y}` >= min.slice(0, 4) && `${y}` <= max.slice(0, 4)) {
      setViewMonth(m);
      setViewYear(y);
    }
  };

  return (
    <div className="calendar-picker" role="dialog" aria-label="Choose birth date">
      <div className="calendar-picker__head">
        <button type="button" className="calendar-picker__nav" onClick={() => stepByYears(-1)} aria-label="Previous year">«</button>
        <button type="button" className="calendar-picker__nav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <span className="calendar-picker__label">
          <button
            type="button"
            className="calendar-picker__headbtn"
            aria-label="Choose month"
            onClick={() => setListMode(listMode === 'months' ? 'days' : 'months')}
          >
            {MONTHS[viewMonth]}
          </button>
          <button
            type="button"
            className="calendar-picker__headbtn"
            aria-label="Choose year"
            onClick={() => setListMode(listMode === 'years' ? 'days' : 'years')}
          >
            {viewYear}
          </button>
        </span>
        <button type="button" className="calendar-picker__nav" onClick={() => step(1)} aria-label="Next month">›</button>
        <button type="button" className="calendar-picker__nav" onClick={() => stepByYears(1)} aria-label="Next year">»</button>
        <button type="button" className="calendar-picker__close" onClick={onClose} aria-label="Close calendar">✕</button>
      </div>
      {listMode !== 'days' ? (
        <div className="calendar-picker__list" role="listbox">
          {listMode === 'months'
            ? MONTHS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className={i === viewMonth ? 'calendar-picker__listitem calendar-picker__listitem--active' : 'calendar-picker__listitem'}
                  onClick={() => { setViewMonth(i); setListMode('days'); }}
                >
                  {name}
                </button>
              ))
            : Array.from({ length: maxYearDyn - 1925 + 1 }, (_, i) => maxYearDyn - i).map((yy) => (
                <button
                  key={yy}
                  type="button"
                  className={yy === viewYear ? 'calendar-picker__listitem calendar-picker__listitem--active' : 'calendar-picker__listitem'}
                  onClick={() => { setViewYear(yy); setListMode('days'); }}
                >
                  {yy}
                </button>
              ))}
        </div>
      ) : (
      <div className="calendar-picker__grid" role="grid">
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar-picker__weekday">{d}</span>
        ))}
        {grid.map((cell, i) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              className={
                cell.iso === value
                  ? 'calendar-picker__day calendar-picker__day--selected'
                  : cell.iso < min || cell.iso > max
                    ? 'calendar-picker__day calendar-picker__day--out'
                    : 'calendar-picker__day'
              }
              disabled={cell.iso < min || cell.iso > max}
              onClick={() => { onPick(cell.iso); onClose(); }}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`pad-${i}`} className="calendar-picker__pad" />
          ),
        )}
      </div>
      )}
    </div>
  );
}

export default CalendarPicker;
