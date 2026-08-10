/**
 * The org's scheduled weekdays — shared, pure, server-safe helpers.
 *
 * Attendance aggregations used to hardcode Mon–Fri in each module. They now take the org's
 * configured `workdays` (`GET /v1/org/working-hours`) so a Sun–Thu week, or a six-day week, lines up
 * with what the backend's attendance close cron actually classifies.
 *
 * **A day off is "not expected", not "not recorded".** Time worked on an unscheduled day is still
 * recorded and still counts toward hours — the schedule only decides who is *absent*. Never use
 * these helpers to filter recorded time out of a total.
 */

import type { IsoWeekday } from "@/modules/settings/services/org.service";

export type { IsoWeekday };

/**
 * Mon–Fri — the same default the backend applies when an org has never set a schedule
 * (`WorkingHours::default()`). Deliberately not all seven days: this default is what lets an empty
 * Tuesday count as absent.
 */
export const DEFAULT_WORKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5];

/** JS `Date.getDay()` is 0 = Sunday; ISO is 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date): IsoWeekday {
  const dow = d.getDay();
  return (dow === 0 ? 7 : dow) as IsoWeekday;
}

/** Is this date one of the org's scheduled days? */
export function isWorkday(d: Date, workdays: readonly IsoWeekday[]): boolean {
  return workdays.includes(isoWeekday(d));
}

/**
 * Guard a schedule coming from the API or a stale cache. An empty list would make every aggregation
 * return nothing at all (an empty chart, a zero denominator), so fall back to the default rather
 * than render a silently meaningless view.
 */
export function safeWorkdays(
  days: readonly IsoWeekday[] | null | undefined,
): IsoWeekday[] {
  return days && days.length > 0 ? [...days] : [...DEFAULT_WORKDAYS];
}
