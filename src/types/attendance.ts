/**
 * Attendance status model (LLD §7) — server-safe, no imports.
 *
 * Mirrors `AttendanceStatus` in the backend's `time-attendance` crate. **Statuses are
 * computed, never tracked**: the 00:15 close cron derives them from what the agent
 * recorded, the org's working hours, and approved leave. A status nobody can set is a
 * status nobody can fudge — which is the point for a record that feeds payroll and
 * performance conversations. The frontend only ever displays them.
 *
 * Resolution order, first match wins:
 *   0. an admin override (`excused`, or a forced leave/non_workday)  →  1. leave  →
 *   2. non_workday  →  3. absent  →  4. partial  →  5. present
 *
 * **Permission is not in this list.** Short time off inside a working day (`docs/LEAVE.md`) does not
 * change the day's status: the person turned up, and the server credits the approved minutes toward
 * presence so the day still resolves `present` rather than `partial`.
 */

export type DayStatus =
  /** An approved leave request covers the day. */
  | "leave"
  /**
   * A holiday or non-scheduled day. **Excluded from the expected set — not a counted
   * status**, so it must never land in an absence rate's denominator.
   */
  | "non_workday"
  /** A scheduled workday with no session and no leave. */
  | "absent"
  /** A session exists but recorded time is below `min_present_minutes`. */
  | "partial"
  /**
   * A session exists and time ≥ `min_present_minutes`.
   *
   * **`late` is a qualifier on present, not a sixth status** (LLD §7: "effective:
   * present / present-late"). A late arrival is present. Carry it as the separate
   * `late: boolean` on the record — never as a peer in this union.
   */
  | "present"
  /**
   * An admin excused the day (`PUT /v1/attendance/user/{id}/day/{date}/override`, managed-agent
   * orgs only). The one status a person can set — audited server-side, never presence.
   */
  | "excused";

/**
 * Does this day count toward an attendance rate's denominator?
 *
 * `non_workday` is excluded by §7 — counting Sundays as absences would skew every rate
 * in the same direction and look like an epidemic of truancy. `excused` is excluded too: the
 * server's own summaries (`/v1/me/attendance`, `/v1/attendance/day`) leave it out of `counted`, and
 * an excused day counted here read as an absence on every client tally (QA audit 2026-10-08,
 * WP-257).
 */
export function isCounted(status: DayStatus): boolean {
  return status !== "non_workday" && status !== "excused";
}
