/**
 * Time-tracking view models for the **team / oversight** timesheet.
 *
 * These shapes were previously invented by `lib/mock-time.ts`; they now live in the module and are
 * populated from the real backend by `use-team-timesheet.ts` (see that hook for how each field maps
 * to a live call). Kept as a local contract so no component imports `@/lib/mock-*`.
 */

/** Health of a person's/project's tracked time — not an approval state.
 *  `flagged` marks a low-activity anomaly worth a look; `on-track` is normal. */
export type TimesheetStatus = "on-track" | "flagged";

/**
 * One real time entry, resolved for display in the drill-down.
 * `label` is a project name (person rows) or a contributor's name (project rows); `hours` is the
 * entry's real `duration_secs / 3600`. Nothing here is seeded.
 */
export interface TimesheetDayEntry {
  label: string;
  hours: number;
}

export interface TeamMemberTime {
  id: string;
  name: string;
  avatarUrl?: string;
  department: string;
  /** Hours tracked this week. */
  trackedHrs: number;
  /** Real hours per weekday, Mon→Sun (length 7). Sums to `trackedHrs`. */
  days: number[];
  /** Real time entries per weekday, Mon→Sun (length 7). `label` = project name. */
  dayEntries: TimesheetDayEntry[][];
  /** Idle hours this week. */
  idleHrs: number;
  billablePct: number;
  /** Avg activity 0–100. */
  activity: number;
  status: TimesheetStatus;
}

export interface ProjectTimesheet {
  id: string;
  name: string;
  key: string;
  department: string;
  /** People who logged time against the project. */
  members: number;
  /** Tracked hours this week (weekly base). */
  trackedHrs: number;
  /** Real hours per weekday, Mon→Sun (length 7). Sums to `trackedHrs`. */
  days: number[];
  /** Real time entries per weekday, Mon→Sun (length 7). `label` = contributor name. */
  dayEntries: TimesheetDayEntry[][];
  status: TimesheetStatus;
}

export interface DailyHours {
  day: string;
  /** Total tracked hours. */
  hours: number;
  /** Of which billable. */
  billable: number;
}

/** Hours (decimal) → "6h 12m". */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
