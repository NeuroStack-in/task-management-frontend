/**
 * The org dashboard's data contract.
 *
 * The types below are the exact shape the (verbatim) preview widgets consume; the values are now
 * assembled from the **live backend** by `use-dashboard-data.ts` (was a seeded mock builder). Where a
 * source needs the desktop agent that isn't reporting yet (heatmap, screenshots, per-person scores),
 * the field degrades honestly to 0 / empty and its widget shows a "waiting on the agent" state — no
 * fabricated numbers.
 */
import type { User, UserStatus } from "@/types/user";

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
  team: string; // "all" or a department name
  /** ISO "YYYY-MM-DD" bounds, only used when range === "range". */
  start?: string;
  end?: string;
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
  screenshotsTrend: number[];
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
  statusCounts: Record<UserStatus, number>;
  activeCount: number;
  inactiveCount: number;
}

/* --------------------------------- helpers -------------------------------- */

/** Distinct departments (the dashboard's "team" axis), sorted. */
export function teamsOf(users: User[]): string[] {
  return Array.from(new Set(users.map((u) => u.department))).sort();
}
