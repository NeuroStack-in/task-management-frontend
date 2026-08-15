/**
 * One definition of "attended", for every attendance surface.
 *
 * This exists because there were two, in opposite directions, over the same server data:
 *
 * - the overview chart folded `partial` into `present` (`use-oversight-attendance`), and
 * - the calendar excluded it, so it fell into the red "Absent / partial" bar
 *   (`attendance-calendar`'s own `rateOf`).
 *
 * On 11 Aug — 4 present, 1 partial, 8 absent of 13 — that read **38%** on the chart and **31%** on
 * the calendar, for the same day. Whoever was checking had to open the roster to find out which was
 * true, which is the whole reason the summary exists.
 *
 * The server never conflated them: `attendance_oversight` increments `partial` and `present`
 * separately, all the way to the client. Both interpretations were invented here, so the fix is one
 * shared function rather than picking a winner in two places.
 *
 * **Partial counts as attended.** Someone who clocked in briefly did show up; filing them with the
 * people who never appeared is the more wrong of the two answers, and it is the one that makes a
 * manager chase a no-show who was actually at their desk. Surfaces should still *show* partial as
 * its own band — counting it as attendance is not the same as hiding it.
 */

/** The status counts every attendance surface has, whatever else it carries. */
export interface AttendanceCounts {
  present: number;
  partial: number;
}

/** People who showed up at all: fully present **plus** partially present. */
export function attended(c: AttendanceCounts): number {
  return c.present + c.partial;
}

/**
 * Attendance rate as a whole percentage, 0 when nothing was counted.
 *
 * `counted` excludes non-working days — a weekend must not read as an absence, which is the same
 * rule `time-attendance::summarize` applies server-side (LLD §7).
 */
export function attendanceRate(c: AttendanceCounts, counted: number): number {
  if (!counted) return 0;
  return Math.round((attended(c) / counted) * 100);
}

/** Rate to one decimal — for the headline figure, which is precise enough to move day to day. */
export function attendanceRate1dp(c: AttendanceCounts, counted: number): number {
  if (!counted) return 0;
  return Math.round((attended(c) / counted) * 1000) / 10;
}
