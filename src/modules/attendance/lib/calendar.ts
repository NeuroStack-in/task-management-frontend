/**
 * Presentational calendar date-math for the Attendance module.
 *
 * Pure functions over explicit `new Date(y, m, d)` args — the one clock read is
 * `today()`, which the grid takes as a parameter, so the month grid is stable across
 * renders. **No attendance data lives here**: the calendar just lays out the grid; the
 * wired views overlay the real records from `GET /v1/me/attendance` /
 * `GET /v1/attendance/day`.
 *
 * (Relocated verbatim out of the deleted `lib/mock-attendance.ts`, which mixed
 * these helpers with fabricated data. The data died with that file; the math
 * lives on here.)
 */
export { isCounted, type DayStatus } from "@/types/attendance";

import { DEFAULT_WORKDAYS, type IsoWeekday } from "@/lib/workdays";

/** A calendar date with a **0-indexed** month. */
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/**
 * The **real current date**, read from the local clock on every call.
 *
 * It used to be a constant evaluated once at module load, so a tab left open past midnight kept the
 * load day as "today": yesterday's closed record read as the future, the Today buttons jumped back a
 * day and the date pickers refused the real today (QA audit 2026-10-08, WP-258). Components read it
 * through `useToday()`, which re-renders them when the date turns over. The views render only after
 * `AuthGuard` hydrates, so a client clock here never meets a server render.
 */
export function today(): CalendarDay {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

/** One cell in the six-week month grid. Carries layout only — no attendance data. */
export interface DayCell {
  day: number;
  month: number;
  year: number;
  inMonth: boolean;
  /** 0 = Mon … 6 = Sun. */
  weekday: number;
  /** One of the org's **scheduled** days (see `monthMatrix`'s `workdays`) and in-month. */
  isWorkday: boolean;
  isToday: boolean;
}

const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Is the date after `now` (default: the real today)? Such a day has no record yet. */
export function isFutureDate(
  year: number,
  month: number,
  day: number,
  now: CalendarDay = today(),
): boolean {
  return (
    new Date(year, month, day).getTime() >
    new Date(now.year, now.month, now.day).getTime()
  );
}

/**
 * Six-week (Monday-first) matrix for a month, including leading/trailing days
 * from adjacent months (flagged `inMonth: false`).
 *
 * `workdays` are the org's scheduled ISO weekdays (1 = Mon … 7 = Sun) — pass `useWorkdays()` so the
 * grid greys out the same days the backend treats as off. Defaults to Mon–Fri, which is what the
 * server assumes for an org that has never configured a schedule.
 *
 * `now` decides which cell is `isToday` — pass `useToday()` (and list it in the memo's deps) so the
 * highlight moves at midnight.
 */
export function monthMatrix(
  year: number,
  month: number,
  workdays: readonly IsoWeekday[] = DEFAULT_WORKDAYS,
  now: CalendarDay = today(),
): DayCell[][] {
  const firstWeekday = mondayIndex(new Date(year, month, 1).getDay());
  const total = daysInMonth(year, month);
  const prevTotal = daysInMonth(year, month - 1);

  const make = (d: number, m: number, y: number, inMonth: boolean): DayCell => {
    const weekday = mondayIndex(new Date(y, m, d).getDay());
    // `weekday` is 0 = Mon; ISO is 1 = Mon.
    const isWorkday = inMonth && workdays.includes((weekday + 1) as IsoWeekday);
    return {
      day: d,
      month: m,
      year: y,
      inMonth,
      weekday,
      isWorkday,
      isToday: inMonth && y === now.year && m === now.month && d === now.day,
    };
  };

  const cells: DayCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevTotal - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push(make(d, m, y, false));
  }
  for (let d = 1; d <= total; d++) cells.push(make(d, month, year, true));
  let nextDay = 1;
  while (cells.length < 42) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push(make(nextDay++, m, y, false));
  }

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
  return weeks;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
