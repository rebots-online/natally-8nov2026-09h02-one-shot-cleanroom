// Birth-date input helpers for the first-light onboarding intake
// (src/onboarding-original). Mirrors the operator-authorized original
// contract exactly — the untouched onboarding components call these with
// typed/pasted `YYYY/MM/DD` strings and expect the messages below.

export interface BirthDateParts {
  day: string;
  month: string;
  year: string;
}

export function getBirthDateParts(value: string): BirthDateParts {
  const [year = '', month = '', day = ''] = value.replaceAll('/', '-').split('-');
  return { day, month, year };
}

export function getBirthMonthDays(year: number, month: number): number {
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function formatBirthDateInput(value: string, previousValue: string): string {
  const deletingSeparator = /[-/]$/.test(previousValue) && value === previousValue.slice(0, -1);
  const digits = (deletingSeparator ? value.slice(0, -1) : value).replace(/\D/g, '').slice(0, 8);
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (month && (Number(month[0]) > 1 || (month.length === 2 && (Number(month) < 1 || Number(month) > 12)))) {
    return previousValue;
  }
  const maxDay = getBirthMonthDays(Number(year), Number(month));
  if (day && (Number(day[0]) > Math.floor(maxDay / 10) || (day.length === 2 && (Number(day) < 1 || Number(day) > maxDay)))) {
    return previousValue;
  }
  return year + (year.length === 4 ? '/' + month : '') + (month.length === 2 ? '/' + day : '');
}

export function validateBirthDate(value: string, maxDate: string) {
  const { day, month, year } = getBirthDateParts(value);
  const invalid = (message: string) => ({ isoDate: null, message, invalid: true });
  if (!day || !month || year.length < 4) {
    return { isoDate: null, message: 'Type YYYYMMDD (slashes appear automatically), or choose below. Tap the year to jump years.', invalid: false };
  }
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(value.replaceAll('/', '-'))) {
    return invalid('Enter a day, month and four-digit year.');
  }
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1 || numericDay > getBirthMonthDays(numericYear, numericMonth)) {
    return invalid('That day does not exist in the chosen month. Check the day, month and year.');
  }
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (isoDate < '1925-01-01' || isoDate > maxDate) {
    return invalid(`Choose a date between 1 Jan 1925 and ${maxDate} (one year ahead).`);
  }
  const label = new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return { isoDate, message: `✓ ${label}`, invalid: false };
}
