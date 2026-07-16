import type { User, UserStatus } from "@/types/user";
import {
  attendanceCounts,
  statusCounts,
  productivityHeatmap,
  type AttendanceStatus,
} from "@/lib/mock-metrics";

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

interface RangeMeta {
  /** Trend labels for the Productivity Trends area chart. */
  labels: string[];
  /** Headline label, e.g. "this week". */
  unit: string;
  /** Base screenshots captured for the range. */
  screenshotBase: number;
  /** Working days in the window, used to total tracked hours. */
  workdays: number;
}

const RANGE_META: Record<Exclude<DashboardRange, "range">, RangeMeta> = {
  today: {
    labels: ["9a", "11a", "1p", "3p", "5p", "7p", "now"],
    unit: "today",
    screenshotBase: 180,
    workdays: 1,
  },
  "7d": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    unit: "this week",
    screenshotBase: 1284,
    workdays: 5,
  },
  "30d": {
    labels: ["W1", "W2", "W3", "W4", "W5"],
    unit: "this month",
    screenshotBase: 5400,
    workdays: 22,
  },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Builds range meta for a user-picked custom window (range === "range"). Pure and
 * deterministic — parses the explicit ISO bounds (no Date.now()). Falls back to a
 * month-like window until both ends are chosen. ~245 screenshots/workday and ~7.4
 * tracked hours/workday match the fixed-range ratios above.
 */
function customRangeMeta(start?: string, end?: string): RangeMeta {
  if (!start || !end) {
    return { labels: ["W1", "W2", "W3", "W4"], unit: "selected range", screenshotBase: 5000, workdays: 20 };
  }
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
  const workdays = Math.max(1, Math.round((days * 5) / 7));
  const ticks = Math.min(6, days);
  const labels = Array.from({ length: ticks }, (_, i) => {
    const offset = ticks > 1 ? Math.round((i * (days - 1)) / (ticks - 1)) : 0;
    const d = new Date(s.getTime() + offset * 86_400_000);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  });
  const unit = `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
  return { labels, unit, screenshotBase: workdays * 245, workdays };
}

/* ------------------------------- determinism ------------------------------ */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** A stable [-1, 1] wave for (seed, i) — no Math.random, SSR-safe. */
function wave(seed: number, i: number): number {
  const x = Math.sin(seed * 0.013 + i * 0.9) + Math.cos(seed * 0.007 + i * 0.45);
  return x / 2;
}

/** Deterministic delta % in roughly [-9, +12], seeded by a key. */
function deltaFor(key: string): number {
  const h = hash(key);
  return Math.round(((h % 220) / 10) - 9);
}

function seededTrend(key: string, base: number, amp: number, n = 7): number[] {
  const seed = hash(key);
  return Array.from({ length: n }, (_, i) =>
    Math.round(clamp(base + wave(seed, i) * amp + ((seed >> i) % 5), 0, 100)),
  );
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
  topPerformers: User[];
  billing: { plan: string; seatsUsed: number; seatsTotal: number };
  heatmap: number[][];
  /** `late` is a subset of `present`, not a peer — never add the two (LLD §7). */
  attendanceCounts: Record<AttendanceStatus, number> & { late: number };
  statusCounts: Record<UserStatus, number>;
  activeCount: number;
  inactiveCount: number;
}

/* --------------------------------- helpers -------------------------------- */

/** Distinct departments (the dashboard's "team" axis), sorted. */
export function teamsOf(users: User[]): string[] {
  return Array.from(new Set(users.map((u) => u.department))).sort();
}

/* ------------------------------- main builder ----------------------------- */

/**
 * Derives every dashboard widget's data from the raw user list and the active
 * filters. Pure and deterministic (seeded by range + team), so it runs the same
 * on the server and after any client-side filter change — no Date.now()/random.
 */
export function buildDashboardData(
  users: User[],
  filters: DashboardFilters,
): DashboardData {
  const { range, team } = filters;
  const meta =
    range === "range" ? customRangeMeta(filters.start, filters.end) : RANGE_META[range];
  const scope = team === "all" ? users : users.filter((u) => u.department === team);
  // Seed includes the custom bounds so changing the picked range re-derives data.
  const key = (k: string) =>
    `${range}:${filters.start ?? ""}:${filters.end ?? ""}:${team}:${k}`;

  const active = scope.filter((u) => u.status === "active").length;
  const inactive = scope.filter((u) => u.status === "inactive").length;
  const avgProductivity = scope.length
    ? Math.round(
        scope.reduce((s, u) => s + u.productivityScore, 0) / scope.length,
      )
    : 0;
  const runningTimers = Math.round(active * 0.42);

  // Period aggregates (deterministic; seeded by range + team).
  const hoursTracked = Math.round(scope.length * 7.4 * meta.workdays);
  // New hires onboarded in the window. Deterministic and scaled by headcount and
  // window length (~0.6% of the team per workday-week), so a month shows more
  // than a week and a single team fewer than the whole org.
  const newHires = Math.max(1, Math.round(scope.length * 0.006 * meta.workdays));

  // Attendance rate = present share over the scope. A core workforce-health headline
  // for admins; derived from the same counts the Attendance donut uses so the two never
  // disagree. `present` already includes late arrivals (`late` is a qualifier, LLD §7),
  // so it is NOT added — the denominator sums the disjoint statuses only, and
  // `non_workday` stays out of it by design.
  const attn = attendanceCounts(scope);
  const attnTotal = attn.present + attn.partial + attn.leave + attn.absent;
  const attendanceRate = attnTotal
    ? Math.round((attn.present / attnTotal) * 100)
    : 0;

  const topPerformers = [...scope]
    .sort((a, b) => b.productivityScore - a.productivityScore)
    .slice(0, 5);

  // Average productivity per department (comparison stays global across teams).
  const byDept = new Map<string, number[]>();
  for (const u of users) {
    const arr = byDept.get(u.department) ?? [];
    arr.push(u.productivityScore);
    byDept.set(u.department, arr);
  }
  const teamData = [...byDept.entries()]
    .map(([dept, scores]) => ({
      team: dept.split(" ")[0],
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  const productivityTrend: TrendPoint[] = meta.labels.map((label, i) => {
    const a = Math.round(clamp(avgProductivity + 8 + wave(hash(key("trend")), i) * 12));
    return { label, active: a, productive: clamp(a - (6 + ((hash(label) + i) % 8))) };
  });

  const screenshotCount = Math.round(
    meta.screenshotBase * (scope.length / (users.length || 1) || 1),
  );

  return {
    range,
    team,
    rangeLabel: meta.unit,
    kpis: {
      productivity: {
        value: avgProductivity,
        deltaPct: deltaFor(key("productivity")),
        trend: seededTrend(key("productivity"), avgProductivity, 10),
      },
      active: {
        value: active,
        deltaPct: deltaFor(key("active")),
        trend: seededTrend(key("active"), 64, 14),
      },
      inactive: {
        value: inactive,
        deltaPct: deltaFor(key("inactive")),
        trend: seededTrend(key("inactive"), 30, 8),
      },
      timers: {
        value: runningTimers,
        deltaPct: deltaFor(key("timers")),
        trend: seededTrend(key("timers"), 22, 12),
      },
      hours: {
        value: hoursTracked,
        deltaPct: deltaFor(key("hours")),
        trend: seededTrend(key("hours"), 60, 30),
      },
      attendance: {
        value: attendanceRate,
        deltaPct: deltaFor(key("attendance")),
        trend: seededTrend(key("attendance"), attendanceRate, 6),
      },
      newHires: {
        value: newHires,
        deltaPct: deltaFor(key("hires")),
        trend: seededTrend(key("hires"), 40, 22),
      },
    },
    productivityTrend,
    teamData,
    screenshotCount,
    screenshotsTrend: seededTrend(key("shots"), 60, 30),
    topPerformers,
    billing: { plan: "Business", seatsUsed: active, seatsTotal: 120 },
    heatmap: productivityHeatmap(),
    attendanceCounts: attn,
    statusCounts: statusCounts(scope),
    activeCount: active,
    inactiveCount: inactive,
  };
}
