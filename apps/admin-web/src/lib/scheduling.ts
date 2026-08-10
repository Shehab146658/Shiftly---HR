export function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index));
}

export function configuredWeekStart(isoDate: string, weekStartIsodow: number): string {
  if (!Number.isInteger(weekStartIsodow) || weekStartIsodow < 1 || weekStartIsodow > 7) {
    throw new RangeError("Week start must be an ISO weekday from 1 to 7.");
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const jsWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday;
  return addIsoDays(isoDate, -((isoWeekday - weekStartIsodow + 7) % 7));
}

export function currentMonday(now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const distance = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + distance);
  return date.toISOString().slice(0, 10);
}

export function formatScheduleTime(value?: string | null): string {
  return value ? String(value).slice(0, 5) : "";
}

export type WeekdayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export function weekdayKey(isoDate: string): WeekdayKey {
  const [year, month, day] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const)[weekday];
}
