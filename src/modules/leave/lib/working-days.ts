/**
 * Leave is charged in **working days** (owner decision 2026-10-20, UX audit TIME-07): the org's
 * weekends and holidays inside a request cost nothing — Fri → Mon is 2 days on a Mon–Fri week, not 4.
 *
 * These mirror the server's `shared::leave::{WorkCalendar, working_days, working_portions}`, built
 * from the same two sources (`GET /v1/org/working-hours` `workdays`, `GET /v1/org/holidays`), so the
 * request form previews exactly what the server will charge. Pure date math on `YYYY-MM-DD` strings
 * in UTC — no time zone can shift a day.
 */

import { DEFAULT_WORKDAYS, type IsoWeekday } from "@/lib/workdays";

export interface WorkCalendar {
  /** Scheduled ISO weekdays, 1 = Monday … 7 = Sunday. */
  workdays: readonly IsoWeekday[];
  /** Org holidays, `YYYY-MM-DD`. */
  holidays: ReadonlySet<string>;
}

export const DEFAULT_CALENDAR: WorkCalendar = {
  workdays: DEFAULT_WORKDAYS,
  holidays: new Set(),
};

/** Days since 1970-01-01 for a real `YYYY-MM-DD`, or `null`. */
function epochDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  // Reject 2026-02-31 and friends, which Date.UTC would quietly roll into March.
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return ms / 86_400_000;
}

function isoOf(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function isWorking(day: number, cal: WorkCalendar): boolean {
  // 1970-01-01 was a Thursday (ISO weekday 4).
  const weekday = ((((day + 3) % 7) + 7) % 7) + 1;
  return cal.workdays.includes(weekday as IsoWeekday) && !cal.holidays.has(isoOf(day));
}

/** Is `iso` a working day — scheduled and not an org holiday? */
export function isWorkingDay(iso: string, cal: WorkCalendar): boolean {
  const d = epochDay(iso);
  return d !== null && isWorking(d, cal);
}

/** Working days in `from..=to` — what a full-day request costs. `0` for a bad or backwards range. */
export function workingDays(from: string, to: string, cal: WorkCalendar): number {
  const a = epochDay(from);
  const b = epochDay(to);
  if (a === null || b === null || b < a) return 0;
  let n = 0;
  for (let d = a; d <= b; d++) if (isWorking(d, cal)) n++;
  return n;
}

/** Calendar days in `from..=to` that cost nothing — the weekends and holidays the form names. */
export function freeDays(from: string, to: string, cal: WorkCalendar): number {
  const a = epochDay(from);
  const b = epochDay(to);
  if (a === null || b === null || b < a) return 0;
  return b - a + 1 - workingDays(from, to, cal);
}

/**
 * How a request's `days` split across calendar years — `[[year, days]]`, oldest first. Mirrors
 * `working_portions`: each year's share is its own working days, checked (and at approval debited)
 * against that year's balance; a request inside one year is that year's alone, at its own `days`
 * (a permission's fraction).
 */
export function workingPortions(
  from: string,
  to: string,
  days: number,
  cal: WorkCalendar,
): [string, number][] {
  const fy = from.slice(0, 4);
  const ty = to.slice(0, 4);
  if (!/^\d{4}$/.test(fy) || !/^\d{4}$/.test(ty) || ty < fy) return [];
  if (fy === ty) return [[fy, days]];
  const out: [string, number][] = [];
  for (let y = Number(fy); y <= Number(ty); y++) {
    const lo = y === Number(fy) ? from : `${y}-01-01`;
    const hi = y === Number(ty) ? to : `${y}-12-31`;
    out.push([String(y), workingDays(lo, hi, cal)]);
  }
  return out;
}
