/**
 * Presentational calendar date-math for the Attendance module.
 *
 * Pure functions only — explicit `new Date(y, m, d)` args (no `Date.now()` /
 * `Math.random()`), so the month grid is stable across renders. **No attendance
 * data lives here**: the calendar just lays out the grid; the wired views overlay
 * the real records from `GET /v1/me/attendance` / `GET /v1/attendance/day`.
 *
 * (Relocated verbatim out of the deleted `lib/mock-attendance.ts`, which mixed
 * these helpers with fabricated data. The data died with that file; the math
 * lives on here.)
 */
export { isCounted, type DayStatus } from "@/types/attendance";

/**
 * "Today" and the month the calendar opens on — the **real current date**.
 *
 * (Was a hardcoded demo clock, `2026-06-25`, which pinned every calendar to June and made real
 * months look empty/future. Computed once at module load from the local clock; the wired views only
 * render their calendars client-side — after a mount effect resolves the selected date — so this
 * matches the browser's day and never hydrates against a stale server value.)
 */
const _now = new Date();
export const TODAY = {
  year: _now.getFullYear(),
  month: _now.getMonth(),
  day: _now.getDate(),
};
export const REFERENCE_MONTH = { year: TODAY.year, month: TODAY.month };

/** One cell in the six-week month grid. Carries layout only — no attendance data. */
export interface DayCell {
  day: number;
  month: number;
  year: number;
  inMonth: boolean;
  /** 0 = Mon … 6 = Sun. */
  weekday: number;
  /** Weekday (Mon–Fri) and in-month. */
  isWorkday: boolean;
  isToday: boolean;
}

const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Is the date in the future relative to the demo "today"? (No records yet.) */
export function isFutureDate(year: number, month: number, day: number): boolean {
  return (
    new Date(year, month, day).getTime() >
    new Date(TODAY.year, TODAY.month, TODAY.day).getTime()
  );
}

/**
 * Six-week (Monday-first) matrix for a month, including leading/trailing days
 * from adjacent months (flagged `inMonth: false`).
 */
export function monthMatrix(year: number, month: number): DayCell[][] {
  const firstWeekday = mondayIndex(new Date(year, month, 1).getDay());
  const total = daysInMonth(year, month);
  const prevTotal = daysInMonth(year, month - 1);

  const make = (d: number, m: number, y: number, inMonth: boolean): DayCell => {
    const weekday = mondayIndex(new Date(y, m, d).getDay());
    const isWorkday = inMonth && weekday < 5;
    return {
      day: d,
      month: m,
      year: y,
      inMonth,
      weekday,
      isWorkday,
      isToday:
        inMonth && y === TODAY.year && m === TODAY.month && d === TODAY.day,
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
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
