/**
 * Deterministic mock data for the Insights section (Activity, Screenshots,
 * Anomalies, Reports). Server-safe — no `Date.now()`/`Math.random()`, so values
 * are stable across renders/reloads (SPEC.md §5). Real names are pulled from the
 * seeded user dataset so the views feel connected.
 */
import { users } from "@/lib/data";
import type { User } from "@/types/user";

/* --------------------------------- People -------------------------------- */

// Screenshot / anomaly subjects. Lead with one monitored team (Design /
// Product Design) so a team-scoped view is populated, then fill with other
// people for the org-wide view. Deterministic (sorted by id).
const SCREENSHOT_TEAM = users.filter(
  (u) =>
    u.department === "Design" &&
    u.team === "Product Design" &&
    (u.status === "active" || u.status === "inactive"),
);
const SCREENSHOT_TEAM_IDS = new Set(SCREENSHOT_TEAM.map((u) => u.id));
/** A stable handful of people to attribute screenshots/anomalies to. */
export const SAMPLE_PEOPLE: User[] = [
  ...[...SCREENSHOT_TEAM].sort((a, b) => a.id.localeCompare(b.id)),
  ...[...users]
    .filter((u) => !SCREENSHOT_TEAM_IDS.has(u.id))
    .sort((a, b) => a.id.localeCompare(b.id)),
].slice(0, 12);

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

/** Daily buckets (Mon → Sun) for the weekly view. */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const ACTIVITY_BY_DAY = [74, 81, 78, 83, 69, 41, 28];
export const KEYBOARD_BY_DAY = [70, 78, 74, 80, 64, 34, 22];
export const MOUSE_BY_DAY = [60, 66, 63, 69, 55, 38, 26];

/** Weekly buckets (W1 → W5) for the monthly view. */
export const WEEK_LABELS = ["W1", "W2", "W3", "W4", "W5"];
export const ACTIVITY_BY_WEEK = [71, 76, 68, 80, 73];
export const KEYBOARD_BY_WEEK = [66, 72, 61, 77, 69];
export const MOUSE_BY_WEEK = [58, 63, 54, 67, 60];

export type Granularity = "daily" | "weekly" | "monthly";

export interface ActivitySeries {
  granularity: Granularity;
  labels: string[];
  active: number[];
  keyboard: number[];
  mouse: number[];
  /** Heading for the main activity chart. */
  title: string;
}

/** Rotate values relative to fixed labels — a deterministic way for a chosen
 * date to vary the mock curve without faking a backend. */
function phase(values: number[], by: number): number[] {
  const n = values.length;
  if (n === 0 || by % n === 0) return values;
  const k = ((by % n) + n) % n;
  return [...values.slice(k), ...values.slice(0, k)];
}

/**
 * Activity series for a granularity, optionally phase-shifted by a numeric
 * seed (e.g. derived from a chosen date) so changing the date moves the curve.
 */
export function activitySeries(
  granularity: Granularity,
  seed = 0,
): ActivitySeries {
  const base =
    granularity === "weekly"
      ? {
          labels: DAY_LABELS,
          active: ACTIVITY_BY_DAY,
          keyboard: KEYBOARD_BY_DAY,
          mouse: MOUSE_BY_DAY,
          title: "Activity by day",
        }
      : granularity === "monthly"
        ? {
            labels: WEEK_LABELS,
            active: ACTIVITY_BY_WEEK,
            keyboard: KEYBOARD_BY_WEEK,
            mouse: MOUSE_BY_WEEK,
            title: "Activity by week",
          }
        : {
            labels: HOUR_LABELS,
            active: ACTIVITY_BY_HOUR,
            keyboard: KEYBOARD_BY_HOUR,
            mouse: MOUSE_BY_HOUR,
            title: "Activity by hour",
          };
  return {
    granularity,
    labels: base.labels,
    active: phase(base.active, seed),
    keyboard: phase(base.keyboard, seed),
    mouse: phase(base.mouse, seed),
    title: base.title,
  };
}

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
  /** Host machine the capture came from, e.g. "HP EliteDesk 800 G6". */
  device: string;
  /** Monitor / virtual desktop on that machine the capture came from (1-based). */
  desktop: number;
}

/** Host machine models we attribute monitored employees to (deterministic). */
const DEVICE_MODELS = [
  "HP EliteDesk 800 G6",
  "Dell OptiPlex 7090",
  "Lenovo ThinkCentre M90",
  "HP ProDesk 400 G7",
  "Apple Mac mini M2",
  "Dell Latitude 5540",
];

/** Stable per-user seed reused for device + desktop assignment. */
function userSeed(user: User): number {
  return [...user.id].reduce((s, c) => s + c.charCodeAt(0), 0);
}

/** The (single) machine an employee is monitored on. */
export function deviceFor(user: User): string {
  return DEVICE_MODELS[userSeed(user) % DEVICE_MODELS.length];
}

/** How many monitors / virtual desktops that machine has (2 or 3). */
export function desktopCountFor(user: User): number {
  return 2 + (userSeed(user) % 2);
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
export const SCREENSHOTS: Screenshot[] = SAMPLE_PEOPLE.flatMap((user, pi) => {
  const device = deviceFor(user);
  const desks = desktopCountFor(user);
  return SHOT_DATES.flatMap((date, di) =>
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
        device,
        // Spread the day's captures across the machine's desktops.
        desktop: (k % desks) + 1,
      };
    }),
  );
});

export interface EmployeeShots {
  user: User;
  shots: Screenshot[];
  total: number;
  flagged: number;
  avgActivity: number;
  /** Most recent capture (cover thumbnail). */
  latest: Screenshot;
  /** The machine this employee is monitored on. */
  device: string;
  /** Desktop / monitor numbers this employee has captures on (sorted). */
  desktops: number[];
}

/** Screenshots grouped by employee, with per-person summary stats. */
export const SCREENSHOT_EMPLOYEES: EmployeeShots[] = SAMPLE_PEOPLE.map(
  (user) => {
    const shots = SCREENSHOTS.filter((s) => s.user.id === user.id);
    const flagged = shots.filter((s) => s.flagged).length;
    const avgActivity = Math.round(
      shots.reduce((a, s) => a + s.activity, 0) / shots.length,
    );
    const desktops = Array.from(new Set(shots.map((s) => s.desktop))).sort(
      (a, b) => a - b,
    );
    return {
      user,
      shots,
      total: shots.length,
      flagged,
      avgActivity,
      latest: shots[0],
      device: deviceFor(user),
      desktops,
    };
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

export const ANOMALY_KIND_LABEL: Record<AnomalyKind, string> = {
  inactivity: "Inactivity",
  "productivity-drop": "Productivity drop",
  burnout: "Burnout",
  "after-hours": "After hours",
  policy: "Policy",
};

/** Short, plain-language description of what each anomaly kind detects. */
export const ANOMALY_KIND_SIGNAL: Record<AnomalyKind, string> = {
  inactivity: "Idle time during core hours while the timer was running.",
  "productivity-drop": "Activity fell sharply below the trailing 7-day average.",
  burnout: "Sustained long hours with no breaks across multiple days.",
  "after-hours": "Significant work logged well outside normal hours.",
  policy: "Time on distracting / non-work domains above the team norm.",
};

/** Anomalies detected per day this week, split by severity (for the trend). */
export const ANOMALY_TREND: {
  day: string;
  high: number;
  medium: number;
  low: number;
}[] = [
  { day: "Mon", high: 1, medium: 1, low: 2 },
  { day: "Tue", high: 0, medium: 2, low: 1 },
  { day: "Wed", high: 2, medium: 1, low: 1 },
  { day: "Thu", high: 1, medium: 1, low: 0 },
  { day: "Fri", high: 1, medium: 2, low: 1 },
  { day: "Sat", high: 0, medium: 0, low: 1 },
  { day: "Sun", high: 0, medium: 1, low: 0 },
];

/* -------------------------------- Reports -------------------------------- */

export type ReportCategory =
  | "workforce"
  | "time"
  | "projects"
  | "attendance"
  | "activity"
  | "monitoring";

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
  attendance: "Attendance",
  activity: "Activity",
  monitoring: "Monitoring",
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

const PROJ_PREFIX = [
  "Acme", "Platform", "Mobile", "Billing", "Data", "Search", "Identity", "Growth",
  "Core", "Partner", "Insights", "Payments", "Comms", "Design", "Admin", "Ops",
];
const PROJ_SUFFIX = [
  "Storefront", "Pipeline", "Revamp", "Migration", "Service", "Portal",
  "Console", "API", "Sync", "Platform",
];

/**
 * 50 projects, deterministic. (prefix, suffix) indices form a bijection for
 * i < prefix×suffix, so generated names stay unique.
 */
export const PROJECT_HOURS: ProjectHours[] = Array.from({ length: 50 }, (_, i) => ({
  project: `${PROJ_PREFIX[i % PROJ_PREFIX.length]} ${
    PROJ_SUFFIX[Math.floor(i / PROJ_PREFIX.length) % PROJ_SUFFIX.length]
  }`,
  hours: 40 + ((i * 53) % 380),
  members: 2 + ((i * 7) % 14),
  onTrack: i % 3 !== 0,
}));

export interface EmployeeTime {
  id: string;
  name: string;
  /** First name — compact axis label. */
  first: string;
  department: string;
  jobTitle: string;
  avatarUrl?: string;
  productivity: number; // %
  tracked: number;
  idle: number;
  billable: number; // %
  capacity: number; // hrs/week
  billableHrs: number;
  utilization: number; // %
}

/** The tracked workforce — every active/inactive employee (100+ at full seed). */
const WORKFORCE: User[] = users.filter(
  (u) => u.status === "active" || u.status === "inactive",
);

export const EMPLOYEE_TIME: EmployeeTime[] = WORKFORCE.map((u) => {
  const seed = [...u.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const capacity = 40;
  const billableHrs = 14 + (seed % 28); // 14–41h → spreads utilization across bands
  return {
    id: u.id,
    name: u.name,
    first: u.name.split(" ")[0],
    department: u.department,
    jobTitle: u.jobTitle,
    avatarUrl: u.avatarUrl,
    productivity: u.productivityScore,
    tracked: 30 + (seed % 14),
    idle: 1 + (seed % 5),
    billable: 45 + (seed % 50),
    capacity,
    billableHrs,
    utilization: Math.min(100, Math.round((billableHrs / capacity) * 100)),
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
    rows: WORKFORCE.map((u, i) => [
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
    description: "Top 10 performers ranked by productivity score this week.",
    category: "workforce",
    period: "This week",
    columns: ["Rank", "Employee", "Department", "Productivity %"],
    rows: [...WORKFORCE]
      .sort((a, b) => b.productivityScore - a.productivityScore)
      .slice(0, 10)
      .map((u, i) => [i + 1, u.name, u.department, u.productivityScore]),
  },
  {
    id: "time",
    name: "Timesheet Summary",
    description: "Tracked vs idle hours and billable split per employee.",
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
    description: "Hours tracked per project with completion estimates.",
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
  // --- WorkPulse-specific reports (driven by this app's own modules) ---
  {
    id: "attendance",
    name: "Attendance Summary",
    description:
      "Per-employee present / late / leave / absent days and attendance rate.",
    category: "attendance",
    period: "This week",
    columns: ["Employee", "Department", "Present", "Late", "On leave", "Absent", "Rate %"],
    rows: WORKFORCE.map((u) => {
      const seed = [...u.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      const absent = seed % 5 === 0 ? 1 : 0;
      const leave = seed % 7 === 0 ? 1 : 0;
      const late = seed % 3 === 0 ? 1 : 0;
      const present = 5 - absent - leave - late;
      const rate = Math.round(((present + late) / 5) * 100);
      return [u.name, u.department, present, late, leave, absent, rate];
    }),
  },
  {
    id: "app-usage",
    name: "App & Website Usage",
    description:
      "Time spent per application and site, classified productive / neutral / distracting.",
    category: "activity",
    period: "Today",
    columns: ["Source", "Name", "Category", "Minutes", "Share %"],
    rows: (() => {
      const items = [
        ...APP_USAGE.map((a) => ({ source: "App", ...a })),
        ...URL_USAGE.map((a) => ({ source: "Website", ...a })),
      ];
      const total = items.reduce((s, it) => s + it.minutes, 0) || 1;
      return items.map((it) => [
        it.source,
        it.name,
        CATEGORY_LABEL[it.category],
        it.minutes,
        Math.round((it.minutes / total) * 100),
      ]);
    })(),
  },
  {
    id: "anomalies",
    name: "Anomaly & Risk Report",
    description:
      "Flagged burnout, inactivity, and productivity-drop signals with severity.",
    category: "monitoring",
    period: "This week",
    columns: ["Employee", "Anomaly", "Severity", "Detail", "When"],
    rows: ANOMALIES.map((a) => [
      a.user.name,
      a.title,
      SEVERITY_META[a.severity].label,
      a.detail,
      a.time,
    ]),
  },
  {
    id: "screenshots",
    name: "Screenshot Compliance",
    description:
      "Capture volume, flagged shots, and average activity per monitored employee.",
    category: "monitoring",
    period: "This week",
    columns: ["Employee", "Captures", "Flagged", "Avg activity %"],
    rows: SCREENSHOT_EMPLOYEES.map((e) => [
      e.user.name,
      e.total,
      e.flagged,
      e.avgActivity,
    ]),
  },
];
