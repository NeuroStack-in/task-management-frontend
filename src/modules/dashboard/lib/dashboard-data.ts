/**
 * The org dashboard's data contract.
 *
 * The types below are the exact shape the (verbatim) preview widgets consume; the values are now
 * assembled from the **live backend** by `use-dashboard-data.ts` (was a seeded mock builder). Where a
 * source needs the desktop agent that isn't reporting yet (heatmap, screenshots, per-person scores),
 * the field degrades honestly to 0 / empty and its widget shows a "waiting on the agent" state — no
 * fabricated numbers.
 */
import type { User } from "@/types/user";

/* --------------------------------- filters -------------------------------- */

export type DashboardRange = "today" | "7d" | "30d" | "range";

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Week" },
  { value: "30d", label: "Month" },
  { value: "range", label: "Custom" },
];

export interface DashboardFilters {
  range: DashboardRange;
  /**
   * `"all"` or a **`department_id`**.
   *
   * It holds the id, not the display name, deliberately. Matching on the label meant the filter
   * broke in three ways: two departments sharing a name silently merged; a department whose label
   * was missing from `GET /v1/departments` fell back to its raw UUID and appeared in the dropdown as
   * one; and a rename mid-session stopped matching entirely. The id is also what the server's
   * `?dept=` query wants, which is what makes the roster properly paginated.
   */
  team: string;
  /** ISO "YYYY-MM-DD" bounds, only used when range === "range". */
  start?: string;
  end?: string;
}

/** One entry in the dashboard's department ("team") filter — id for matching, label for display. */
export interface TeamOption {
  id: string;
  label: string;
}

/**
 * Headcount buckets the **server can actually distinguish** — deliberately *not*
 * `Record<UserStatus, number>`.
 *
 * `UserStatus` is the mock/seed vocabulary (`active | inactive | invited | suspended`). The real
 * `workforce` context only ever produces three states, and they don't line up with it:
 *
 * | Server | Where it lives | Here |
 * |---|---|---|
 * | `active` | `USER#` row | `active` |
 * | `deactivated` | `USER#` row | `inactive` (the UI's word — normalised at the service seam) |
 * | `invited` | an `INVITE#` row, **not** in the directory | `invited` |
 * | — | there is no suspended state | *(dropped)* |
 *
 * The third row is the trap: `create_invite` writes `INVITE#`/`EMAILREF#` items and **no `USER#`
 * row**, so an invited person is absent from `GET /v1/employees` entirely. Counting the directory
 * alone can never produce a non-zero `invited` — it has to come from `GET /v1/employees/invites`.
 */
export interface HeadcountCounts {
  active: number;
  /** Employment ended — the server's `deactivated`. */
  inactive: number;
  /** Invite sent, not yet accepted, not yet expired. */
  invited: number;
}

/* ------------------------------- shared types ----------------------------- */

export interface KpiSeries {
  value: number;
  deltaPct: number;
  trend: number[];
}

export interface TrendPoint {
  label: string;
  active: number;
  productive: number;
}

/**
 * Attendance buckets for the donut. These are the real `time-attendance` statuses the oversight
 * endpoint serves (`present` / `partial` / `absent` / `leave`); `non_workday` is excluded from the
 * tally and there is no per-person `late` on that index, so it isn't invented here.
 */
export type AttendanceStatus = "present" | "partial" | "leave" | "absent";

/** A ranked performer for the Top performers widget — the lean shape it actually needs. */
export interface Performer {
  id: string;
  name: string;
  department: string;
  productivityScore: number;
  avatarUrl?: string;
}

export interface DashboardData {
  range: DashboardRange;
  team: string;
  rangeLabel: string;
  kpis: {
    productivity: KpiSeries;
    // Point-in-time (shown for the "Today" range)
    active: KpiSeries;
    inactive: KpiSeries;
    timers: KpiSeries;
    // Period aggregates (shown for 7d / 30d / range)
    hours: KpiSeries;
    attendance: KpiSeries;
    newHires: KpiSeries;
  };
  productivityTrend: TrendPoint[];
  teamData: { team: string; score: number }[];
  screenshotCount: number;
  /**
   * `true` when at least one day in the window hit the screenshot grid's page cap, so
   * `screenshotCount` is a **floor**, not a total. Render it as "1,234+" rather than a precise
   * figure — silently publishing a capped count as exact is how a filtered view ends up quietly
   * under-reporting.
   */
  screenshotCountPartial: boolean;
  screenshotsTrend: number[];
  /**
   * Distinct employees with at least one capture over the range — "is monitoring actually reaching
   * the team", the question a bare total can't answer. `0` when nothing was captured.
   */
  screenshotsCoverage: number;
  /** Captures worth a review (a distracting-app frame, `ShotRow.flagged`) — the actionable queue. */
  screenshotsFlagged: number;
  /**
   * Server-classified split of the range's captures, for the on-task bar. All zero when the agent's
   * captures are unclassified (older frames), which the widget renders as an honest "unclassified".
   */
  screenshotsSplit: { productive: number; neutral: number; distracting: number };
  topPerformers: Performer[];
  billing: { plan: string; seatsUsed: number; seatsTotal: number };
  heatmap: number[][];
  attendanceCounts: Record<AttendanceStatus, number>;
  /**
   * How many **closed** days in the window actually carry attendance statuses.
   *
   * `0` means the rate is not measurable yet, not that it is zero — today's statuses don't exist
   * until the 00:15 close cron runs. Consumers must render an absence, never `0%`, or the card
   * reads "nobody attended" next to a live productivity score built from those same people.
   */
  attendanceResolvedDays: number;
  /**
   * How many of the trackable team actually produced a score, for the best-covered day in the
   * window. The productivity score divides by `team`, so this is what makes a low number readable:
   * "4% · 1 of 14 reporting" is thin coverage, not a collapsed workforce.
   */
  productivityCoverage: { scored: number; team: number };
  statusCounts: HeadcountCounts;
  /**
   * Directory headcount — **employment status**, not "working right now".
   *
   * The KPI strip's live pair (`kpis.active` / `kpis.inactive`) counts *running timers* and is
   * labelled "Working now / Not working" for exactly this reason: both facts used to be called
   * "active" and rendered on the same screen with different values.
   */
  activeCount: number;
  inactiveCount: number;
}

/* --------------------------------- helpers -------------------------------- */

/** Distinct departments (the dashboard's "team" axis), sorted. */
export function teamsOf(users: User[]): string[] {
  return Array.from(new Set(users.map((u) => u.department))).sort();
}
