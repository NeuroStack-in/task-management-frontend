/**
 * Server-safe derivations & presentation helpers for Projects.
 *
 * No "use client" — pure functions + literal Tailwind class maps so both the
 * server page and the client views read from one place. Anything dependent on
 * "today" uses the fixed TODAY anchor (matches the seed) to stay deterministic
 * (no Date.now() in render paths — CLAUDE.md convention).
 */
import type { User } from "@/types/user";
import type { Project, Task, TaskStatus } from "./types";

/** Fixed reference date — same anchor the seed uses. */
export const TODAY = new Date("2026-06-23T00:00:00Z").getTime();
const DAY = 86_400_000;

export interface UserMini {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle: string;
}

/** Slim, prop-friendly user lookup (avoids shipping the full user array). */
export function buildUserMap(users: User[]): Record<string, UserMini> {
  const map: Record<string, UserMini> = {};
  for (const u of users) {
    map[u.id] = {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      jobTitle: u.jobTitle,
    };
  }
  return map;
}

/* ----------------------------- formatting ----------------------------- */

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Whole days from the fixed anchor to the given ISO date (negative = past). */
export function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - TODAY) / DAY);
}

/** Human due-date label, e.g. "in 4d", "Today", "3d overdue". */
export function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No date", overdue: false };
  const d = daysUntil(iso);
  if (d === 0) return { text: "Today", overdue: false };
  if (d < 0) return { text: `${-d}d overdue`, overdue: true };
  if (d <= 6) return { text: `in ${d}d`, overdue: false };
  return { text: formatDate(iso), overdue: false };
}

/* ------------------------------- health ------------------------------- */

export type Tone = "primary" | "success" | "warning" | "muted" | "negative";

export interface BudgetHealth {
  pct: number; // spent / budget, 0..1.x
  tone: Tone;
  label: string;
}

export function budgetHealth(p: Project): BudgetHealth {
  const pct = p.budget > 0 ? p.spent / p.budget : 0;
  if (pct >= 1) return { pct, tone: "negative", label: "Over budget" };
  if (pct >= 0.9) return { pct, tone: "warning", label: "Near limit" };
  return { pct, tone: "success", label: "On budget" };
}

/** A project needing attention: live, but over budget or overdue & unfinished. */
export function isAtRisk(p: Project): boolean {
  if (p.status !== "active" && p.status !== "on_hold") return false;
  const overBudget = p.spent > p.budget;
  const overdue = daysUntil(p.dueDate) < 0 && p.progress < 100;
  return overBudget || overdue;
}

export interface PortfolioStats {
  total: number;
  active: number;
  atRisk: number;
  avgProgress: number;
  /** Aggregate pulse across active projects — feeds the featured KPI sparkline. */
  pulse: number[];
}

export function portfolioStats(projects: Project[]): PortfolioStats {
  const active = projects.filter((p) => p.status === "active");
  const live = projects.filter(
    (p) => p.status === "active" || p.status === "on_hold",
  );
  const avgProgress = live.length
    ? Math.round(live.reduce((s, p) => s + p.progress, 0) / live.length)
    : 0;

  const pulse = [0, 0, 0, 0, 0, 0, 0];
  for (const p of active) p.velocity.forEach((v, i) => (pulse[i] += v));

  return {
    total: projects.length,
    active: active.length,
    atRisk: projects.filter(isAtRisk).length,
    avgProgress,
    pulse: pulse.some((v) => v > 0) ? pulse : [10, 14, 12, 18, 16, 22, 24],
  };
}

/** Counts per task status for one project's tasks. */
export function taskCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
  };
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}

/* --------------------- tone → literal class maps ---------------------- */
/* Literal strings (not interpolated) so Tailwind keeps them at build.    */

export const toneText: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted-foreground",
  negative: "text-destructive",
};

export const toneDot: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/60",
  negative: "bg-destructive",
};

export const toneBar: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/50",
  negative: "bg-destructive",
};

export const toneSoft: Record<Tone, string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
  negative: "bg-destructive/12 text-destructive",
};

/** Left accent rail tint on cards. */
export const toneRail: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-border",
  negative: "bg-destructive",
};
