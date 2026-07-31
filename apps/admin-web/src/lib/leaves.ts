export type CalendarDay = {
  date: string;
  dayNumber: number;
  inMonth: boolean;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function validCalendarMonth(yearValue: unknown, monthValue: unknown, now = new Date()) {
  const parsedYear = Number(yearValue);
  const parsedMonth = Number(monthValue);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2200
    ? parsedYear
    : now.getUTCFullYear();
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : now.getUTCMonth() + 1;
  return { year, month };
}

export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: isoDate(start), end: isoDate(end) };
}

// Egypt commonly presents business calendars Saturday through Friday.
export function calendarMonthDays(year: number, month: number): CalendarDay[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 1) % 7;
  const gridStart = new Date(Date.UTC(year, month - 1, 1 - startOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return {
      date: isoDate(date),
      dayNumber: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
    };
  });
}

export function adjacentMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function dateFallsWithin(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}
