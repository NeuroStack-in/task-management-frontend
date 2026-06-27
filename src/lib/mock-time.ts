/**
 * Deterministic mock time-tracking data (SPEC.md §5, Time Tracking — Phase 2).
 *
 * No randomness or `Date.now()`, so values are stable across renders/reloads
 * and safe to compute on the server. The shape mirrors what a real timesheet
 * API would return; the mock service seam (lib/data.ts) drops in later.
 */
import { employeeWeek } from "@/lib/employee-metrics";

export interface TimeEntry {
  id: string;
  task: string;
  project: string;
  /** Local clock string, e.g. "09:12". */
  start: string;
  /** Local clock string, e.g. "10:45". null while running. */
  end: string | null;
  durationSec: number;
  billable: boolean;
  /** Activity level 0–100 (keyboard/mouse intensity for the segment). */
  activity: number;
}

export interface TaskOption {
  taskId: string;
  taskTitle: string;
  projectName: string;
  billable: boolean;
}

/** Tasks the user can start a timer against (timer task picker). */
export const TASK_OPTIONS: TaskOption[] = [
  {
    taskId: "WP-412",
    taskTitle: "Checkout flow — payment step",
    projectName: "Acme Storefront",
    billable: true,
  },
  {
    taskId: "WP-389",
    taskTitle: "Design review: dashboard v2",
    projectName: "Acme Storefront",
    billable: true,
  },
  {
    taskId: "WP-455",
    taskTitle: "Fix flaky integration tests",
    projectName: "Platform",
    billable: false,
  },
  {
    taskId: "WP-301",
    taskTitle: "Customer onboarding call",
    projectName: "Customer Success",
    billable: true,
  },
  {
    taskId: "INT-12",
    taskTitle: "Sprint planning & standup",
    projectName: "Internal",
    billable: false,
  },
];

const HMS = (h: number, m: number) =>
  `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

/** Today's logged segments, in chronological order. Deterministic. */
export const TODAYS_ENTRIES: TimeEntry[] = [
  {
    id: "te-1",
    task: "Sprint planning & standup",
    project: "Internal",
    start: HMS(9, 5),
    end: HMS(9, 38),
    durationSec: 33 * 60,
    billable: false,
    activity: 54,
  },
  {
    id: "te-2",
    task: "Checkout flow — payment step",
    project: "Acme Storefront",
    start: HMS(9, 45),
    end: HMS(11, 28),
    durationSec: 103 * 60,
    billable: true,
    activity: 88,
  },
  {
    id: "te-3",
    task: "Design review: dashboard v2",
    project: "Acme Storefront",
    start: HMS(11, 35),
    end: HMS(12, 20),
    durationSec: 45 * 60,
    billable: true,
    activity: 72,
  },
  {
    id: "te-4",
    task: "Fix flaky integration tests",
    project: "Platform",
    start: HMS(13, 30),
    end: HMS(15, 2),
    durationSec: 92 * 60,
    billable: false,
    activity: 81,
  },
  {
    id: "te-5",
    task: "Customer onboarding call",
    project: "Customer Success",
    start: HMS(15, 15),
    end: HMS(16, 0),
    durationSec: 45 * 60,
    billable: true,
    activity: 63,
  },
];

export interface DailyHours {
  day: string;
  /** Total tracked hours. */
  hours: number;
  /** Of which billable. */
  billable: number;
}

/** Hours tracked per weekday this week (Mon–Sun). Deterministic. */
export const WEEKLY_HOURS: DailyHours[] = [
  { day: "Mon", hours: 7.8, billable: 5.9 },
  { day: "Tue", hours: 8.4, billable: 6.7 },
  { day: "Wed", hours: 6.9, billable: 4.8 },
  { day: "Thu", hours: 8.1, billable: 6.2 },
  { day: "Fri", hours: 5.4, billable: 3.6 },
  { day: "Sat", hours: 1.1, billable: 0.4 },
  { day: "Sun", hours: 0, billable: 0 },
];

export interface TimeSummary {
  todaySec: number;
  weekHours: number;
  billablePct: number;
  avgActivity: number;
  /** 7-point sparkline trends for the KPI strip. */
  trends: {
    today: number[];
    week: number[];
    billable: number[];
    activity: number[];
  };
}

export function summarize(
  entries: TimeEntry[],
  week: DailyHours[],
): TimeSummary {
  const todaySec = entries.reduce((s, e) => s + e.durationSec, 0);
  const weekHours = week.reduce((s, d) => s + d.hours, 0);
  const billableHours = week.reduce((s, d) => s + d.billable, 0);
  const billablePct = weekHours ? Math.round((billableHours / weekHours) * 100) : 0;
  const avgActivity = entries.length
    ? Math.round(entries.reduce((s, e) => s + e.activity, 0) / entries.length)
    : 0;

  return {
    todaySec,
    weekHours,
    billablePct,
    avgActivity,
    trends: {
      today: cumulativeHours(entries),
      week: week.map((d) => d.hours),
      billable: week.map((d) => Math.round((d.billable / (d.hours || 1)) * 100)),
      activity: entries.map((e) => e.activity),
    },
  };
}

/** Running total of hours across today's entries — a rising pulse line. */
function cumulativeHours(entries: TimeEntry[]): number[] {
  let acc = 0;
  return entries.map((e) => {
    acc += e.durationSec / 3600;
    return Math.round(acc * 10) / 10;
  });
}

/** Hours (decimal) → "6h 12m". */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* --------------------------- Team / oversight --------------------------- */

export type TimesheetStatus = "approved" | "pending" | "flagged";

export interface TeamMemberTime {
  id: string;
  name: string;
  avatarUrl?: string;
  department: string;
  /** Hours tracked this week. */
  trackedHrs: number;
  /** Idle hours this week. */
  idleHrs: number;
  billablePct: number;
  /** Avg activity 0–100. */
  activity: number;
  status: TimesheetStatus;
}

interface MinimalUser {
  id: string;
  name: string;
  avatarUrl?: string;
  department: string;
  status: string;
  productivityScore: number;
}

/**
 * Deterministic per-person weekly timesheet for the oversight view. Derived from
 * the seeded users (no randomness), so it's stable across renders. The mock
 * service seam (lib/data.ts) drops a real API in later.
 */
export function buildTeamTimesheet(users: MinimalUser[]): TeamMemberTime[] {
  return users
    .filter((u) => u.status === "active" || u.status === "inactive")
    .map((u) => {
      const seed = [...u.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      // Hours come from the shared employee-metrics source so they match the
      // numbers shown in Insights → Reports for the same person.
      const ew = employeeWeek(u.id);
      const activity = u.productivityScore;
      const status: TimesheetStatus =
        activity < 45 ? "flagged" : seed % 4 === 0 ? "pending" : "approved";
      return {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        department: u.department,
        trackedHrs: ew.tracked,
        idleHrs: ew.idle,
        billablePct: ew.billablePct,
        activity,
        status,
      };
    });
}

/* ----------------------------- Project-wise ----------------------------- */

export interface ProjectTimesheet {
  id: string;
  name: string;
  key: string;
  department: string;
  /** People who logged time against the project. */
  members: number;
  /** Tracked hours this week (weekly base). */
  trackedHrs: number;
  status: TimesheetStatus;
}

interface MinimalProject {
  id: string;
  name: string;
  key: string;
  department: string;
  memberIds: string[];
  progress: number;
}

/**
 * Deterministic per-project weekly totals for the timesheet grid. Derived from
 * the seeded projects (no randomness), so values are stable across renders.
 */
export function buildProjectTimesheet(
  projects: MinimalProject[],
): ProjectTimesheet[] {
  return projects.map((p) => {
    const seed = [...p.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const members = Math.max(1, p.memberIds.length);
    const trackedHrs = members * (7 + (seed % 5)); // ~7–11h per member / week
    const activity = Math.min(98, 45 + Math.round(p.progress * 0.45) + (seed % 8));
    const status: TimesheetStatus =
      activity < 50 ? "flagged" : seed % 4 === 0 ? "pending" : "approved";
    return {
      id: p.id,
      name: p.name,
      key: p.key,
      department: p.department,
      members,
      trackedHrs,
      status,
    };
  });
}

/** Team-wide tracked hours this week (Mon–Sun). Deterministic. */
export const TEAM_WEEKLY: DailyHours[] = [
  { day: "Mon", hours: 612, billable: 451 },
  { day: "Tue", hours: 648, billable: 489 },
  { day: "Wed", hours: 593, billable: 432 },
  { day: "Thu", hours: 661, billable: 503 },
  { day: "Fri", hours: 524, billable: 372 },
  { day: "Sat", hours: 88, billable: 41 },
  { day: "Sun", hours: 36, billable: 12 },
];
