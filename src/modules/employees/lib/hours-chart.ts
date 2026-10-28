/**
 * The employee profile's "Hours worked" chart: one bar per day with time on it, coloured by that
 * day's attendance verdict.
 *
 * **Built from the timesheet** (AI audit 2026-10-22, AI-63). It was built from the activity rollup,
 * which has a row only for a day the desktop agent reported activity on — so an employee whose hours
 * came from approved corrections read "No work recorded in the last 30 days", while the AI recap on
 * the same profile correctly said 1 h tracked. The timesheet (`GET /v1/timesheet/user/{id}`) counts
 * timer sessions and corrections alike, which is what "hours worked" means everywhere else.
 *
 * The attendance verdict still comes from the activity rollup, the only per-day verdict this page
 * reads; a day it has no row for is drawn as "Attendance not shown" rather than given a verdict it
 * doesn't have. When the viewer can't read the timesheet, the chart falls back to the activity
 * rollup it used before, and says so.
 */

/** A bar whose day has no attendance verdict on this page. */
export const NO_ATTENDANCE = "_no-attendance";

export interface HoursDay {
  date: string;
  label: string;
  /** Hours on the clock — exact, formatted as `HH:MM:SS` by the chart. */
  hours: number;
  status: string;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-08-05` → `Aug 5` for a compact daily axis label. */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

/**
 * Timesheet days → bars. Only days with time on them appear: a day with no sessions is absent from
 * the chart, never drawn as a measured zero.
 */
export function hoursFromTimesheet(
  days: { date: string; total_secs: number }[],
  attendanceByDate: ReadonlyMap<string, string>,
  cutoff: string,
): HoursDay[] {
  return days
    .filter((d) => d.date >= cutoff && d.total_secs > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      label: dayLabel(d.date),
      hours: d.total_secs / 3600,
      status: attendanceByDate.get(d.date) || NO_ATTENDANCE,
    }));
}

/**
 * The fallback when the timesheet can't be read: the activity rollup, as the chart was built before.
 * Height is the attendance-recorded work time once the day has closed, else tracked active time.
 */
export function hoursFromActivity(
  days: { date: string; activeSec: number; workedMinutes: number; attendance: string }[],
  cutoff: string,
): HoursDay[] {
  return days
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      label: dayLabel(d.date),
      hours: d.workedMinutes > 0 ? d.workedMinutes / 60 : d.activeSec / 3600,
      status: d.attendance || "unknown",
    }));
}
