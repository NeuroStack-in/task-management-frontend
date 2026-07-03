/**
 * Prototype report data for the /dev/reports sandbox. Pure + deterministic
 * (hash/index seeds, no Date.now/Math.random) so it can be lifted straight into
 * the real Insights report library later. Everything returns plain data plus a
 * `ReportDef` so the existing exportCsv/exportPdf work unchanged.
 */
import { users } from "@/lib/data";
import {
  EMPLOYEE_TIME,
  ANOMALIES,
  SAMPLE_PEOPLE,
  PROJECT_HOURS,
  HOUR_LABELS,
  ACTIVITY_BY_HOUR,
  ACTIVITY_BY_WEEK,
  WEEK_LABELS,
  type ReportDef,
  type UsageCategory,
} from "@/lib/mock-insights";
import { dayRecordFor, TODAY } from "@/lib/mock-attendance";
import type { User } from "@/types/user";

const RATE = 58; // blended hourly labor cost, USD
const hash = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
export const currency = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/* ----------------------------- 1. Executive Summary ----------------------------- */

export interface ExecKpi {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "flat";
}

export function executiveSummary() {
  const active = users.filter((u) => u.status === "active");
  const headcount = active.length || 1;
  const avgProd = Math.round(
    active.reduce((s, u) => s + u.productivityScore, 0) / headcount,
  );
  const avgUtil = Math.round(
    EMPLOYEE_TIME.reduce((s, e) => s + e.utilization, 0) / EMPLOYEE_TIME.length,
  );
  const totalTracked = EMPLOYEE_TIME.reduce((s, e) => s + e.tracked, 0);
  const laborCost = totalTracked * RATE;
  const burnout = ANOMALIES.filter((a) => a.kind === "burnout").length;

  const present = SAMPLE_PEOPLE.filter((p) => {
    const r = dayRecordFor(p.id, TODAY.year, TODAY.month, TODAY.day);
    return r.status === "present" || r.status === "late";
  }).length;
  const attendanceRate = Math.round((present / SAMPLE_PEOPLE.length) * 100);

  const trend = ACTIVITY_BY_WEEK;
  const dir = trend[trend.length - 1] - trend[trend.length - 2];

  const kpis: ExecKpi[] = [
    { label: "Avg productivity", value: `${avgProd}%`, hint: "this week", tone: dir >= 0 ? "up" : "down" },
    { label: "Utilization", value: `${avgUtil}%`, hint: "billable / capacity" },
    { label: "Hours tracked", value: totalTracked.toLocaleString(), hint: "this week" },
    { label: "Labor cost", value: currency(laborCost), hint: `~$${RATE}/hr blended` },
    { label: "Attendance", value: `${attendanceRate}%`, hint: "clocked in today" },
    { label: "Burnout flags", value: String(burnout), hint: "people at risk", tone: burnout > 0 ? "down" : "flat" },
  ];

  const narrative =
    `Productivity is ${avgProd}% this week (${dir >= 0 ? "up" : "down"} ${Math.abs(dir)} pts vs last week), ` +
    `with utilization at ${avgUtil}% across ${headcount} active people. The team tracked ` +
    `${totalTracked.toLocaleString()} hours (~${currency(laborCost)} in labor) and attendance sits at ${attendanceRate}%. ` +
    (burnout > 0
      ? `${burnout} ${burnout === 1 ? "person is" : "people are"} showing burnout signals and should be reviewed.`
      : "No burnout signals this week.");

  const recommendations = ANOMALIES.slice(0, 3).map((a) => `${a.title} — ${a.detail}`);

  const report: ReportDef = {
    id: "executive-summary",
    name: "Executive Summary",
    description: "Org-level KPI rollup for leadership.",
    category: "workforce",
    period: "This week",
    columns: ["Metric", "Value"],
    rows: kpis.map((k) => [k.label, k.value]),
  };

  return { kpis, narrative, recommendations, trend, trendLabels: WEEK_LABELS, report };
}

/* ----------------------------- 2. Day Timeline ----------------------------- */

export interface TimelineSeg {
  time: string;
  app: string;
  category: UsageCategory;
  activity: number;
}

const APP_BY_LEVEL: Record<UsageCategory, string[]> = {
  productive: ["VS Code", "Figma", "Chrome — Docs"],
  neutral: ["Slack", "Zoom", "Email"],
  distracting: ["YouTube", "Twitter / X", "Break"],
};

export function dayTimeline(personId: string) {
  const person: User = SAMPLE_PEOPLE.find((p) => p.id === personId) ?? SAMPLE_PEOPLE[0];
  const seed = hash(person.id);

  const segs: TimelineSeg[] = HOUR_LABELS.map((label, i) => {
    const activity = Math.max(
      0,
      Math.min(100, ACTIVITY_BY_HOUR[i] + ((seed + i * 7) % 15) - 7),
    );
    const category: UsageCategory =
      activity >= 72 ? "productive" : activity >= 50 ? "neutral" : "distracting";
    const pool = APP_BY_LEVEL[category];
    return { time: label, app: pool[(seed + i) % pool.length], category, activity };
  });

  const rec = dayRecordFor(person.id, TODAY.year, TODAY.month, TODAY.day);
  const avgActivity = Math.round(
    segs.reduce((s, x) => s + x.activity, 0) / segs.length,
  );

  const report: ReportDef = {
    id: `timeline-${person.id}`,
    name: `Day Timeline — ${person.name}`,
    description: "Chronological view of the workday.",
    category: "activity",
    period: "Today",
    columns: ["Time", "Activity %", "Focus", "App"],
    rows: segs.map((s) => [s.time, s.activity, s.category, s.app]),
  };

  return {
    person,
    segs,
    summary: {
      clockIn: rec.clockIn,
      clockOut: rec.clockOut,
      hours: rec.hours,
      avgActivity,
      status: rec.status,
    },
    report,
  };
}

/* -------------------------- 3. Project Profitability -------------------------- */

const projKey = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

export function projectProfitability() {
  // Budget/spent are synthesized from tracked hours × blended rate; on-track
  // projects carry a healthy margin, off-track ones run over budget.
  const rows = PROJECT_HOURS.slice(0, 12).map((ph) => {
    const spent = Math.round(ph.hours * RATE);
    const budget = Math.round(spent * (ph.onTrack ? 1.15 : 0.82));
    return {
      name: ph.project,
      key: projKey(ph.project),
      budget,
      spent,
      burn: Math.round((spent / (budget || 1)) * 100),
      hours: ph.hours,
      margin: budget - spent,
      over: spent > budget,
    };
  });

  const totals = {
    budget: rows.reduce((s, r) => s + r.budget, 0),
    spent: rows.reduce((s, r) => s + r.spent, 0),
    over: rows.filter((r) => r.over).length,
  };

  const report: ReportDef = {
    id: "project-profitability",
    name: "Project Profitability",
    description: "Budget burn and margin per project.",
    category: "projects",
    period: "To date",
    columns: ["Project", "Budget", "Spent", "Burn %", "Hours", "Margin"],
    rows: rows.map((r) => [r.name, r.budget, r.spent, `${r.burn}%`, r.hours, r.margin]),
  };

  return { rows, totals, report };
}

/* ----------------------------- 4. Time-off ----------------------------- */

const LEAVE_ALLOWANCE = 20;
const LEAVE_TYPES = ["Vacation", "Sick", "Personal"];

export function timeOff() {
  const sample = users.filter((u) => u.status === "active").slice(0, 12);
  const rows = sample.map((u) => {
    const seed = hash(u.id);
    const used = seed % 12;
    const upcomingIn = seed % 5 === 0 ? (seed % 20) + 1 : null;
    return {
      name: u.name,
      dept: u.department,
      type: LEAVE_TYPES[seed % LEAVE_TYPES.length],
      used,
      remaining: Math.max(0, LEAVE_ALLOWANCE - used),
      upcomingIn,
    };
  });

  const summary = {
    totalUsed: rows.reduce((s, r) => s + r.used, 0),
    upcoming: rows.filter((r) => r.upcomingIn != null).length,
    offSoon: rows.filter((r) => r.upcomingIn != null && r.upcomingIn <= 3).length,
  };

  const report: ReportDef = {
    id: "time-off",
    name: "Time-off Report",
    description: "Leave taken, balances, and upcoming time off.",
    category: "attendance",
    period: "This year",
    columns: ["Employee", "Department", "Type", "Days used", "Remaining", "Next time off"],
    rows: rows.map((r) => [
      r.name,
      r.dept,
      r.type,
      r.used,
      r.remaining,
      r.upcomingIn != null ? `in ${r.upcomingIn}d` : "—",
    ]),
  };

  return { rows, summary, report };
}
