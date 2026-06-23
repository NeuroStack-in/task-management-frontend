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

/** A grid of recent captures (deterministic), most recent first. */
export const SCREENSHOTS: Screenshot[] = Array.from({ length: 12 }, (_, i) => {
  const person = SAMPLE_PEOPLE[i % SAMPLE_PEOPLE.length];
  const minutesAgo = i * 11 + 3;
  const totalMin = 17 * 60 + 28 - minutesAgo; // count back from 17:28
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const app = SHOT_APPS[i % SHOT_APPS.length];
  const activity = 90 - ((i * 13) % 70);
  return {
    id: `shot-${i + 1}`,
    user: person,
    time: `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`,
    app,
    activity,
    flagged: app === "YouTube" || app === "Reddit" || activity < 25,
  };
});

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

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  period: string;
  columns: string[];
  rows: (string | number)[][];
}

export const REPORTS: ReportDef[] = [
  {
    id: "productivity",
    name: "Productivity Report",
    description: "Per-employee productivity score, active hours, and trend.",
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
    id: "time",
    name: "Time & Attendance",
    description: "Clock-in/out, tracked vs idle, and billable split.",
    period: "This week",
    columns: ["Employee", "Tracked hrs", "Idle hrs", "Billable %"],
    rows: SAMPLE_PEOPLE.map((u, i) => [
      u.name,
      38 + ((i * 5) % 6),
      2 + (i % 4),
      62 + ((i * 6) % 30),
    ]),
  },
  {
    id: "project",
    name: "Project Time Allocation",
    description: "Hours logged per project with completion estimates.",
    period: "This month",
    columns: ["Project", "Hours", "Members", "On track"],
    rows: [
      ["Acme Storefront", 412, 9, "Yes"],
      ["Platform", 288, 6, "Yes"],
      ["Customer Success", 164, 4, "At risk"],
      ["Internal", 96, 12, "Yes"],
      ["Mobile App", 201, 5, "At risk"],
    ],
  },
];
