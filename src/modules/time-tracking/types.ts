/**
 * Time-tracking view models for the **team / oversight** timesheet.
 *
 * These shapes were previously invented by the since-deleted `lib/mock-time.ts`; they now live in
 * the module and are populated from the real backend by `use-team-timesheet.ts` (see that hook for
 * how each field maps to a live call). Kept as a local contract, owned by the module that uses it.
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
  /**
   * The individual session behind this entry. Present for real API rows; absent only for synthesised
   * or rolled-up entries.
   *
   * The drill-down used to group by `label` and show one line per project, which answered "how long
   * on this project" but not "what was actually done" — an admin opening a day saw a single total
   * with no sessions, no task, and no clock times. The API has always returned per-session rows
   * (`ApiDayRow.entries`); the UI was discarding everything except the project and the duration.
   */
  session?: TimesheetSession;
}

/** One tracked session, as the drill-down shows it. Mirrors the fields of `ApiEntryRow` worth reading. */
export interface TimesheetSession {
  id: string;
  /** What the person typed in the agent ("what are you working on?"). Empty when they typed nothing. */
  description: string;
  /** The task id. Kept for keying; the label to show is {@link taskTitle}. */
  taskId: string;
  /**
   * The work's title — `Task · Subtask` when the session ran against a subtask, else the task.
   *
   * Resolved by the server.
   *
   * Empty when the task was deleted, or when the backend predates the field. It used to be
   * unresolvable here at all: an admin reading someone else's day has no list of *their* tasks to
   * join against, which is why this is served rather than looked up.
   */
  taskTitle: string;
  /** Local `HH:MM`. */
  start: string;
  /** Epoch ms the session began — what a **running** row ticks from (`useRunningSeconds`).
   *  `start` is already formatted for display and cannot be subtracted from `Date.now()`. */
  startMs: number;
  /** Local `HH:MM`, or null while the session is still running. */
  end: string | null;
  billable: boolean;
  /** No `end` yet — shown as a state, never as a zero duration. */
  running: boolean;
  /** How the session ended: `user`, `shutdown`, `abandoned`, `superseded`… */
  stopReason?: string;
  /** The task was gone/unassigned at fold. The time still counts; this flags it for a human. */
  taskInvalid: boolean;
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
