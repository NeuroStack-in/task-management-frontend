"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  Camera,
  ArrowUpRight,
  Trophy,
  BellRing,
  TriangleAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/shared/sparkline";
import { initials, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Performer } from "@/modules/dashboard/lib/dashboard-data";
import { getAttention, type AttentionRow } from "@/modules/insights/services/insights.service";
import { listMyTasks, type ApiMyTask } from "@/modules/projects/services/projects.service";

/** Whole days from today to an ISO date (`YYYY-MM-DD`). Negative ⇒ overdue. */
function daysUntil(iso: string): number {
  const today = new Date(`${todayIso()}T00:00:00`);
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** ISO date `n` days before today (local). */
function daysAgoIso(n: number): string {
  const d = new Date(`${todayIso()}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** A score at/under this is "needs attention" even with no formal anomaly (mirrors the AI brief). */
const LOW_SCORE = 55;

/** Human "due in / overdue" label for a task deadline. */
function dueLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d <= 30) return `Due in ${d}d`;
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Subtle footer link that routes a widget to its canonical page. */
function ViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

/* ----------------------------- Top Employees ----------------------------- */

export function TopEmployeesWidget({ people }: { people: Performer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top performers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.length === 0 ? (
          // Scores are the desktop agent's deterministic productivity score — empty until an agent
          // reports. State that rather than seeding a leaderboard.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Trophy className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No scores yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The day&apos;s highest-scoring people rank here once the desktop agent&apos;s activity
              data feeds the scorer.
            </p>
          </div>
        ) : (
          people.map((u, i) => (
            <div key={u.id} className="flex items-center gap-3">
              <span className="w-4 text-xs font-medium text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <Avatar className="size-9">
                <AvatarImage src={u.avatarUrl} alt={u.name} />
                <AvatarFallback className="text-xs">
                  {initials(u.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.department}
                </p>
              </div>
              <span className="font-mono text-sm font-medium text-primary tabular-nums">
                {u.productivityScore}%
              </span>
            </div>
          ))
        )}
        <ViewAllLink href="/employees" label="All employees" />
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Screenshots ---------------------------- */

export function ScreenshotsWidget({
  count,
  trend,
  /**
   * The count is a **floor** — at least one day in the window hit the screenshot grid's page cap, so
   * frames beyond it were never fetched and could not be counted. Shown as "1,234+" rather than a
   * precise figure, because a capped total rendered as exact silently under-reports (and does so
   * hardest when a department filter is active, since the scoped frames may sit past the cut).
   */
  partial = false,
}: {
  count: number;
  trend: number[];
  partial?: boolean;
}) {
  return (
    <Card className="justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Camera className="size-4" />
          </span>
          Screenshots captured
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-display text-3xl font-semibold tabular-nums">
          {count.toLocaleString()}
          {partial && count > 0 ? "+" : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {count === 0
            ? "none captured — the desktop agent isn't reporting yet"
            : partial
              ? "at least this many over the selected range — busy days are counted up to a page limit"
              : "captured over the selected range"}
        </p>
        <Sparkline data={trend} area showDot={false} width={220} height={48} className="w-full" />
        <ViewAllLink href="/insights/screenshots" label="Open Screenshot Center" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ empty / loading helpers ------------------------------ */

function WidgetEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof BellRing;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-md bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Colour tone for an anomaly severity / an overdue deadline. */
function severityTone(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical") return "bg-negative/10 text-negative";
  if (s === "medium" || s === "med") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}

/* --------------------- Alerts & Deadlines (real data) -------------------- */

/**
 * What needs attention **now**: the anomaly scorer's flagged people (overtime / idle / burnout risk,
 * `GET /v1/insights/attention`) plus **overdue** task deadlines (`GET /v1/me/tasks`). Self-fetches like
 * the AI-summary widget. Only shows an empty state when both sources are genuinely clear — never
 * fabricated.
 */
export function AlertsDeadlinesWidget() {
  const [state, setState] = useState<{
    alerts: AttentionRow[];
    overdue: ApiMyTask[];
  } | null>(null);

  useEffect(() => {
    let live = true;
    // Anomaly scoring runs at the nightly close, so today is usually incomplete — look back over the
    // last few days and take the most recent that produced a ranked list (mirrors the AI summary's
    // "last workday"). Overdue tasks are current, not day-scoped.
    const recent = [0, 1, 2, 3].map(daysAgoIso);
    Promise.all([
      Promise.all(
        recent.map((d) =>
          getAttention(d)
            .then((l) => l.people)
            .catch(() => [] as AttentionRow[]),
        ),
      ),
      listMyTasks().catch(() => [] as ApiMyTask[]),
    ]).then(([days, tasks]) => {
      if (!live) return;
      // Most recent day that ranked anyone; keep only those who actually need attention — a firing
      // anomaly, or a low score the brief would call out — never the whole team.
      const people = days.find((p) => p.length > 0) ?? [];
      const alerts = people
        .filter((p) => p.anomaly_count > 0 || p.score <= LOW_SCORE)
        .sort((a, b) => b.attention - a.attention)
        .slice(0, 4);
      const overdue = tasks
        .filter((t) => t.due && t.status !== "done" && daysUntil(t.due) < 0)
        .sort((a, b) => (a.due! < b.due! ? -1 : 1))
        .slice(0, 3);
      setState({ alerts, overdue });
    });
    return () => {
      live = false;
    };
  }, []);

  const nothing = state && state.alerts.length === 0 && state.overdue.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts &amp; deadlines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === null ? (
          <RowsSkeleton />
        ) : nothing ? (
          <WidgetEmpty
            icon={BellRing}
            title="Nothing needs attention"
            body="No one flagged by the scorer and no overdue tasks. Alerts appear here as they arise — nothing is fabricated."
          />
        ) : (
          <>
            {state.alerts.map((a) => {
              const hasAnomaly = a.anomaly_count > 0;
              const label = hasAnomaly
                ? a.reasons.join(", ").replace(/_/g, " ") || "anomaly"
                : "Low productivity";
              return (
                <div key={a.user_id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <TriangleAlert className="size-4 shrink-0 text-warning" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground capitalize">{label}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      hasAnomaly ? severityTone(a.top_severity) : "bg-warning/10 text-warning",
                    )}
                  >
                    {hasAnomaly ? a.top_severity || "flagged" : `${Math.round(a.score)}%`}
                  </span>
                </div>
              );
            })}
            {state.overdue.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarClock className="size-4 shrink-0 text-negative" />
                  <p className="truncate text-sm font-medium">{t.title}</p>
                </div>
                <span className="shrink-0 rounded-full bg-negative/10 px-2 py-0.5 text-xs font-medium text-negative">
                  {dueLabel(t.due!)}
                </span>
              </div>
            ))}
          </>
        )}
        <ViewAllLink href="/insights/anomalies" label="Open anomalies" />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Upcoming Tasks (real data) --------------------------- */

/**
 * The viewer's own tasks with an **upcoming** deadline (`GET /v1/me/tasks`), soonest first — real
 * deadlines from the project boards, not an invented schedule. Overdue items live in Alerts above; this
 * is what's coming.
 */
export function UpcomingTasksWidget() {
  const [tasks, setTasks] = useState<ApiMyTask[] | null>(null);

  useEffect(() => {
    let live = true;
    listMyTasks()
      .then((all) => {
        if (!live) return;
        const upcoming = all
          .filter((t) => t.due && t.status !== "done" && daysUntil(t.due) >= 0)
          .sort((a, b) => (a.due! < b.due! ? -1 : 1))
          .slice(0, 5);
        setTasks(upcoming);
      })
      .catch(() => live && setTasks([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks === null ? (
          <RowsSkeleton />
        ) : tasks.length === 0 ? (
          <WidgetEmpty
            icon={CalendarClock}
            title="Nothing due soon"
            body="Your assigned tasks with an upcoming deadline appear here. Open Projects to see every board."
          />
        ) : (
          tasks.map((t) => {
            const d = daysUntil(t.due!);
            return (
              <div key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    {t.status.replace(/_/g, " ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    d <= 1 ? "bg-warning/10 text-warning" : "bg-feature-tint text-primary",
                  )}
                >
                  {dueLabel(t.due!)}
                </span>
              </div>
            );
          })
        )}
        <ViewAllLink href="/projects" label="View projects" />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Billing Overview --------------------------- */

export function BillingWidget({
  plan,
  seatsUsed,
  seatsTotal,
}: {
  plan: string;
  seatsUsed: number;
  seatsTotal: number;
}) {
  const pct = seatsTotal > 0 ? Math.round((seatsUsed / seatsTotal) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <CreditCard className="size-4" />
          </span>
          Billing overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="font-display text-xl font-semibold capitalize">
            {plan}
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Seats used</span>
            <span className="tabular-nums">
              {seatsUsed} / {seatsTotal}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <ViewAllLink href="/billing" label="Manage billing" />
      </CardContent>
    </Card>
  );
}
