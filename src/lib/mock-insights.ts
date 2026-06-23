/**
 * Deterministic mock data for the Insights section (Activity, Screenshots,
 * Anomalies, Reports). Server-safe — no `Date.now()`/`Math.random()`, so values
 * are stable across renders/reloads (SPEC.md §5). Real names are pulled from the
 * seeded user dataset so the views feel connected.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

/* --------------------------------- People -------------------------------- */

/** A stable handful of people to attribute screenshots/anomalies to. */
export const SAMPLE_PEOPLE: User[] = [...users]
  .sort((a, b) => a.id.localeCompare(b.id))
  .slice(0, 8);

/* ------------------------------- Activity -------------------------------- */

export type UsageCategory = "productive" | "neutral" | "distracting";

export interface UsageItem {
  name: string;
  category: UsageCategory;
  minutes: number;
}

/** Application usage today, descending by time spent. */
export const APP_USAGE: UsageItem[] = [
  { name: "VS Code", category: "productive", minutes: 214 },
  { name: "Chrome — Docs", category: "productive", minutes: 168 },
  { name: "Figma", category: "productive", minutes: 122 },
  { name: "Slack", category: "neutral", minutes: 96 },
  { name: "Zoom", category: "neutral", minutes: 64 },
  { name: "YouTube", category: "distracting", minutes: 41 },
  { name: "Twitter / X", category: "distracting", minutes: 23 },
];

/** Top visited domains today. */
export const URL_USAGE: UsageItem[] = [
  { name: "github.com", category: "productive", minutes: 142 },
  { name: "docs.google.com", category: "productive", minutes: 98 },
  { name: "stackoverflow.com", category: "productive", minutes: 57 },
  { name: "mail.google.com", category: "neutral", minutes: 49 },
  { name: "youtube.com", category: "distracting", minutes: 38 },
  { name: "reddit.com", category: "distracting", minutes: 19 },
];

/** Hourly active-share % across the workday (8a → 7p), 12 points. */
export const ACTIVITY_BY_HOUR = [
  52, 71, 84, 88, 79, 46, 58, 86, 90, 82, 67, 44,
];

export const HOUR_LABELS = [
  "8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p",
];

/** Keyboard vs mouse intensity, same hourly buckets. */
export const KEYBOARD_BY_HOUR = [40, 62, 78, 81, 70, 32, 48, 79, 84, 73, 55, 30];
export const MOUSE_BY_HOUR = [48, 58, 66, 70, 61, 38, 52, 68, 72, 64, 50, 36];

export function usageTotals(items: UsageItem[]): Record<UsageCategory, number> {
  const totals: Record<UsageCategory, number> = {
    productive: 0,
    neutral: 0,
    distracting: 0,
  };
  for (const it of items) totals[it.category] += it.minutes;
  return totals;
}

export const CATEGORY_COLOR: Record<UsageCategory, string> = {
  productive: "var(--success)",
  neutral: "var(--chart-2)",
  distracting: "var(--destructive)",
};

export const CATEGORY_LABEL: Record<UsageCategory, string> = {
  productive: "Productive",
  neutral: "Neutral",
  distracting: "Distracting",
};

/* ------------------------------ Screenshots ------------------------------ */

export interface Screenshot {
  id: string;
  user: User;
  /** ISO capture date, "YYYY-MM-DD". */
  date: string;
  time: string;
  app: string;
  activity: number;
  flagged: boolean;
}

const SHOT_APPS = [
  "VS Code",
  "Figma",
  "Chrome — Docs",
  "Slack",
  "Zoom",
  "Terminal",
  "YouTube",
  "Notion",
  "Postman",
  "Jira",
  "Excel",
  "Reddit",
];

/** Deterministic capture dates spanning two months, most recent first. */
const SHOT_DATES = [
  "2026-06-23",
  "2026-06-22",
  "2026-06-20",
  "2026-06-19",
  "2026-06-16",
  "2026-05-29",
  "2026-05-27",
  "2026-05-22",
];
const SHOT_TIMES = ["09:12", "10:40", "11:55", "14:05", "15:30", "16:48"];

/**
 * Every capture, per employee, across several days (deterministic). The
 * Screenshots page is an employee gallery — drill into a person to see their
 * full history, filterable by month/date — so captures are grouped by user,
 * not presented as a flat recent feed.
 */
export const SCREENSHOTS: Screenshot[] = SAMPLE_PEOPLE.flatMap((user, pi) =>
  SHOT_DATES.flatMap((date, di) =>
    Array.from({ length: 3 }, (_, k) => {
      const idx = pi * 137 + di * 17 + k * 5;
      const app = SHOT_APPS[idx % SHOT_APPS.length];
      const activity = 94 - ((idx * 13) % 78);
      return {
        id: `shot-${user.id}-${di}-${k}`,
        user,
        date,
        time: SHOT_TIMES[(di + k) % SHOT_TIMES.length],
        app,
        activity,
        flagged: app === "YouTube" || app === "Reddit" || activity < 25,
      };
    }),
  ),
);

export interface EmployeeShots {
  user: User;
  shots: Screenshot[];
  total: number;
  flagged: number;
  avgActivity: number;
  /** Most recent capture (cover thumbnail). */
  latest: Screenshot;
}

/** Screenshots grouped by employee, with per-person summary stats. */
export const SCREENSHOT_EMPLOYEES: EmployeeShots[] = SAMPLE_PEOPLE.map(
  (user) => {
    const shots = SCREENSHOTS.filter((s) => s.user.id === user.id);
    const flagged = shots.filter((s) => s.flagged).length;
    const avgActivity = Math.round(
      shots.reduce((a, s) => a + s.activity, 0) / shots.length,
    );
    return { user, shots, total: shots.length, flagged, avgActivity, latest: shots[0] };
  },
);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-23" → "2026-06". */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** "2026-06" → "June 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

/** "2026-06-23" → "Jun 23". */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${MONTH_NAMES[Number(m) - 1].slice(0, 3)} ${Number(d)}`;
}

/* ------------------------------- Anomalies ------------------------------- */

export type AnomalySeverity = "high" | "medium" | "low";
export type AnomalyKind =
  | "inactivity"
  | "productivity-drop"
  | "burnout"
  | "after-hours"
  | "policy";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  user: User;
  title: string;
  detail: string;
  time: string;
}

export const ANOMALIES: Anomaly[] = [
  {
    id: "an-1",
    kind: "burnout",
    severity: "high",
    user: SAMPLE_PEOPLE[0],
    title: "Burnout risk",
    detail: "11h+ tracked for 4 consecutive days, no breaks logged.",
    time: "12m ago",
  },
  {
    id: "an-2",
    kind: "productivity-drop",
    severity: "high",
    user: SAMPLE_PEOPLE[3],
    title: "Sharp productivity drop",
    detail: "Activity down 38% vs the trailing 7-day average.",
    time: "41m ago",
  },
  {
    id: "an-3",
    kind: "inactivity",
    severity: "medium",
    user: SAMPLE_PEOPLE[1],
    title: "Long inactivity",
    detail: "Idle for 47 minutes during core hours with timer running.",
    time: "1h ago",
  },
  {
    id: "an-4",
    kind: "after-hours",
    severity: "medium",
    user: SAMPLE_PEOPLE[5],
    title: "After-hours activity",
    detail: "Sustained work between 11:40pm and 1:20am.",
    time: "3h ago",
  },
  {
    id: "an-5",
    kind: "policy",
    severity: "low",
    user: SAMPLE_PEOPLE[2],
    title: "Distracting-site spike",
    detail: "2h 14m on non-work domains, 3× the team median.",
    time: "5h ago",
  },
  {
    id: "an-6",
    kind: "inactivity",
    severity: "low",
    user: SAMPLE_PEOPLE[6],
    title: "Missing screenshots",
    detail: "Agent offline — no captures received for 2h 10m.",
    time: "6h ago",
  },
];

export const SEVERITY_META: Record<
  AnomalySeverity,
  { label: string; dot: string; badge: string }
> = {
  high: {
    label: "High",
    dot: "bg-destructive",
    badge: "bg-destructive/12 text-destructive",
  },
  medium: {
    label: "Medium",
    dot: "bg-warning",
    badge: "bg-warning/15 text-warning",
  },
  low: {
    label: "Low",
    dot: "bg-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

/* -------------------------------- Reports -------------------------------- */

export type ReportCategory = "workforce" | "time" | "projects";

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  period: string;
  columns: string[];
  rows: (string | number)[][];
}

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  workforce: "Workforce",
  time: "Time & Billing",
  projects: "Projects",
};

/**
 * Typed source datasets — the report tables AND the analytics charts both
 * derive from these, so the numbers always agree (one source of truth).
 */
export interface ProjectHours {
  project: string;
  hours: number;
  members: number;
  onTrack: boolean;
}

export const PROJECT_HOURS: ProjectHours[] = [
  { project: "Acme Storefront", hours: 412, members: 9, onTrack: true },
  { project: "Platform", hours: 288, members: 6, onTrack: true },
  { project: "Customer Success", hours: 164, members: 4, onTrack: false },
  { project: "Internal", hours: 96, members: 12, onTrack: true },
  { project: "Mobile App", hours: 201, members: 5, onTrack: false },
];

export interface EmployeeTime {
  name: string;
  /** First name — compact axis label. */
  first: string;
  tracked: number;
  idle: number;
  billable: number; // %
  capacity: number; // hrs/week
  billableHrs: number;
  utilization: number; // %
}

export const EMPLOYEE_TIME: EmployeeTime[] = SAMPLE_PEOPLE.map((u, i) => {
  const billableHrs = 22 + ((i * 4) % 16);
  const capacity = 40;
  return {
    name: u.name,
    first: u.name.split(" ")[0],
    tracked: 38 + ((i * 5) % 6),
    idle: 2 + (i % 4),
    billable: 62 + ((i * 6) % 30),
    capacity,
    billableHrs,
    utilization: Math.round((billableHrs / capacity) * 100),
  };
});

export const REPORTS: ReportDef[] = [
  {
    id: "productivity",
    name: "Productivity Report",
    description: "Per-employee productivity score, active hours, and trend.",
    category: "workforce",
    period: "This week",
    columns: ["Employee", "Department", "Active hrs", "Productivity %", "Trend"],
    rows: SAMPLE_PEOPLE.map((u, i) => [
      u.name,
      u.department,
      32 + ((i * 7) % 9),
      u.productivityScore,
      i % 3 === 0 ? "down" : "up",
    ]),
  },
  {
    id: "leaderboard",
    name: "Productivity Leaderboard",
    description: "Top performers ranked by productivity score this week.",
    category: "workforce",
    period: "This week",
    columns: ["Rank", "Employee", "Department", "Productivity %"],
    rows: [...SAMPLE_PEOPLE]
      .sort((a, b) => b.productivityScore - a.productivityScore)
      .map((u, i) => [i + 1, u.name, u.department, u.productivityScore]),
  },
  {
    id: "time",
    name: "Time & Attendance",
    description: "Clock-in/out, tracked vs idle, and billable split.",
    category: "time",
    period: "This week",
    columns: ["Employee", "Tracked hrs", "Idle hrs", "Billable %"],
    rows: EMPLOYEE_TIME.map((e) => [e.name, e.tracked, e.idle, e.billable]),
  },
  {
    id: "utilization",
    name: "Utilization Report",
    description: "Billable vs non-billable hours against weekly capacity.",
    category: "time",
    period: "This week",
    columns: ["Employee", "Capacity hrs", "Billable hrs", "Utilization %"],
    rows: EMPLOYEE_TIME.map((e) => [
      e.name,
      e.capacity,
      e.billableHrs,
      e.utilization,
    ]),
  },
  {
    id: "project",
    name: "Project Time Allocation",
    description: "Hours logged per project with completion estimates.",
    category: "projects",
    period: "This month",
    columns: ["Project", "Hours", "Members", "On track"],
    rows: PROJECT_HOURS.map((p) => [
      p.project,
      p.hours,
      p.members,
      p.onTrack ? "Yes" : "At risk",
    ]),
  },
];
