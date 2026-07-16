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
 *   1. leave  →  2. non_workday  →  3. absent  →  4. partial  →  5. present
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
  | "present";

/**
 * Does this day count toward an attendance rate's denominator?
 *
 * `non_workday` is excluded by §7 — counting Sundays as absences would skew every rate
 * in the same direction and look like an epidemic of truancy.
 */
export function isCounted(status: DayStatus): boolean {
  return status !== "non_workday";
}

/** One person's resolved day. `late` is only meaningful when `status === "present"`. */
export interface DayRecord {
  status: DayStatus;
  /** Qualifier on `present`: the first session started after the org late-threshold. */
  late: boolean;
  clockIn: string;
  clockOut: string;
  hours: number;
}

/**
 * Org-wide tally for one day.
 *
 * **`late` is a subset of `present`, not a peer.** Never add them — `present` already
 * includes late arrivals. `total` counts only counted days (`non_workday` excluded).
 */
export interface DayCounts {
  present: number;
  /** Subset of `present`. Display as "of which N late", never as a separate column. */
  late: number;
  partial: number;
  leave: number;
  absent: number;
  total: number;
}

/** Display metadata per status. `late` is styled off the record's qualifier, not here. */
export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  present: "Present",
  partial: "Partial",
  leave: "On leave",
  absent: "Absent",
  non_workday: "Non-working day",
};
