"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CreditCard, Camera, ArrowUpRight, Trophy, BellRing, TriangleAlert, FolderKanban, CheckSquare, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/shared/sparkline";
import { formatDuration, todayIso } from "@/lib/format";
import { useRunningSeconds } from "@/hooks/use-live-refresh";
import { cn } from "@/lib/utils";
import type { LiveTimer, Performer } from "@/modules/dashboard/lib/dashboard-data";
import { getAttention, type AttentionRow } from "@/modules/insights/services/insights.service";
import { getDayOversight, type ApiDayUser } from "@/modules/attendance/services/attendance.service";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import { listMyTasks, listProjects, getProject, type ApiMyTask } from "@/modules/projects/services/projects.service";
import { isOpenTaskStatus } from "@/modules/projects/types";
import { mapWithConcurrency } from "@/lib/concurrency";
import { UserAvatar } from "@/components/shared/user-avatar";

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
        {/* A ranked list of names and numbers, where the number is a composite score most readers
            have never met. Name the measure and its range; the metric explainer covers the rest. */}
        <CardDescription>
          Highest average productivity score (0&ndash;100) in the selected range
        </CardDescription>
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
              <UserAvatar
                userId={u.id}
                name={u.name}
                className="size-9"
                fallbackClassName="text-xs"
              />
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

/* -------------------------- Working now (live timers) -------------------------- */

/** A live elapsed clock, so the seconds visibly tick between the 30 s data polls. */
const liveClock = formatDuration;

/**
 * One running-timer row. The clock is the employee's **whole day so far** — today's completed
 * tracked time (`completedSec`) plus the live elapsed of their currently-open session, which ticks up
 * each second from the session's own start (`useRunningSeconds`). So it climbs smoothly between the
 * 30 s data polls and reads as total time worked today, not just the current sitting.
 */
function LiveTimerRow({ t }: { t: LiveTimer }) {
  const liveSession = useRunningSeconds(t.liveStart);
  const totalToday = t.completedSec + liveSession;
  return (
    <div className="flex items-center gap-3">
      <UserAvatar userId={t.userId} name={t.name} className="size-9" fallbackClassName="text-xs" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.name}</p>
        <p className="truncate text-xs text-muted-foreground">{t.department || "—"}</p>
      </div>
      <span className="flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums text-primary">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success" />
        {liveClock(totalToday)}
      </span>
    </div>
  );
}

/**
 * **Working now** — today's live timers across the org. Reads the same running/`clock_in` signal the
 * KPI strip's "Working now" tile uses (per-user `getUserDay`), and ticks each running row live. Empty
 * until an agent reports; never a seeded list. Links out to the full timesheets page.
 */
export function LiveTimersWidget({ timers }: { timers: LiveTimer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Working now</CardTitle>
        <CardDescription>
          Everyone tracking right now &mdash; total time worked today, ticking live
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {timers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Clock className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No one is tracking right now</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Running timers appear here live as employees start work in the WorkPulse app.
            </p>
          </div>
        ) : (
          timers.map((t) => <LiveTimerRow key={t.userId} t={t} />)
        )}
        <ViewAllLink href="/time-tracking" label="View timesheets" />
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
  /** Distinct employees captured over the range — the "is monitoring reaching the team" signal. */
  coverage = 0,
  /** Captures worth a review (distracting-app frames) — the actionable count. */
  flagged = 0,
  /** Server-classified split of the range's captures, for the on-task bar. */
  split = { productive: 0, neutral: 0, distracting: 0 },
}: {
  count: number;
  trend: number[];
  partial?: boolean;
  coverage?: number;
  flagged?: number;
  split?: { productive: number; neutral: number; distracting: number };
}) {
  const classified = split.productive + split.neutral + split.distracting;
  const pct = (n: number) => (classified > 0 ? (n / classified) * 100 : 0);
  const onTaskPct = classified > 0 ? Math.round(pct(split.productive)) : 0;

  return (
    <Card className="justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Camera className="size-4" />
          </span>
          Screenshots
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Headline: the total, and — the thing a bare count can't tell you — how many people it
            actually reached. A big number from one laptop is a very different story than from ten. */}
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-3xl font-semibold tabular-nums">
            {count.toLocaleString()}
            {partial && count > 0 ? "+" : ""}
          </p>
          {count > 0 && coverage > 0 && (
            <span className="text-xs text-muted-foreground">
              across {coverage} {coverage === 1 ? "person" : "people"}
            </span>
          )}
        </div>

        {count === 0 ? (
          <p className="text-xs text-muted-foreground">
            none captured — the desktop agent isn&apos;t reporting yet
          </p>
        ) : classified > 0 ? (
          <>
            {/* On-task split: productive / neutral / distracting, from the server's app classification.
                This is the point of screenshots — not that they exist, but what they show. */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-success" style={{ width: `${pct(split.productive)}%` }} />
              <div className="bg-muted-foreground/40" style={{ width: `${pct(split.neutral)}%` }} />
              <div className="bg-destructive" style={{ width: `${pct(split.distracting)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{onTaskPct}% productive</span>
              {flagged > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-destructive">
                    {flagged.toLocaleString()} to review
                  </span>
                </>
              )}
            </p>
          </>
        ) : (
          // Captured but not yet classified (older frames) — say so honestly, still surface the queue.
          <p className="text-xs text-muted-foreground">
            {flagged > 0 ? (
              <>
                <span className="font-medium text-destructive">
                  {flagged.toLocaleString()} to review
                </span>
                {" · "}
              </>
            ) : null}
            captured over the selected range
          </p>
        )}

        <Sparkline data={trend} area showDot={false} width={220} height={40} className="w-full" />
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

/* --------------------- Needs attention (real data) -------------------- */

/** One person flagged for a manager's attention, reduced to the single most-important reason. */
interface AttentionItem {
  userId: string;
  name: string;
  reason: string;
  badge: string;
  tone: string;
  /** Higher = more urgent — drives the sort, and which reason wins when a person trips several. */
  rank: number;
}

/** De-jargoned label for the anomaly scorer's reason codes ("idle" → "Low activity"). */
function humanizeReason(reasons: string[]): string {
  const map: Record<string, string> = {
    overtime: "Working long hours",
    idle: "Low activity",
    burnout: "Burnout risk",
    late: "Starting late",
    absence: "Frequent absences",
  };
  if (reasons.length === 0) return "Needs a look";
  const first = map[reasons[0]!] ?? reasons[0]!.replace(/_/g, " ");
  return reasons.length > 1 ? `${first} +${reasons.length - 1}` : first;
}

/** `high → 3`, `medium → 2`, else `1`, so a high-severity flag outranks a low one. */
function severityRank(sev: string): number {
  return sev === "high" ? 3 : sev === "medium" ? 2 : 1;
}

/** Short weekday for an ISO date (`2026-08-13` → `"Thu"`). */
function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, { weekday: "short" });
}

/**
 * **Who needs a manager's attention right now** — individual employees, not deadlines. It used to also
 * list overdue tasks, which duplicated the "Upcoming deadlines" widget beside it; those are gone and
 * this is purely people. Three real signals, deduped to one row per person and ranked by urgency:
 *  - **Not clocked in** — absent on the most recent *closed* workday (`GET /v1/attendance/day`), the
 *    employee name resolved from the directory. Today isn't closed until the 00:15 cron, so the
 *    freshest honest absence is the last closed day, and the row is labelled with it.
 *  - **Anomaly-flagged** — the scorer's overtime / low-activity / burnout signals
 *    (`GET /v1/insights/attention`), shown with a plain-language reason.
 *  - **Low productivity** — a score the AI brief would call out, even with no formal anomaly.
 * Empty only when all three are genuinely clear — never fabricated.
 */
export function AlertsDeadlinesWidget() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);

  useEffect(() => {
    let live = true;
    const recent = [0, 1, 2, 3].map(daysAgoIso);
    Promise.all([
      // Anomaly scoring runs at the nightly close, so today is usually empty — take the most recent
      // day that ranked anyone (mirrors the AI summary's "last workday").
      Promise.all(
        recent.map((d) =>
          getAttention(d)
            .then((l) => l.people)
            .catch(() => [] as AttentionRow[]),
        ),
      ),
      // Attendance is only closed for past days — skip today and take the most recent closed roster.
      Promise.all(
        recent.slice(1).map((d) =>
          getDayOversight(d)
            .then((r) => ({ date: d, users: r.users }))
            .catch(() => ({ date: d, users: [] as ApiDayUser[] })),
        ),
      ),
      listAllEmployees().catch(() => []),
      // A failed roles read must not empty the widget — fall back to including everyone, which is
      // the pre-existing behaviour rather than a silent blank.
      contributorRoleIds().catch(() => null),
    ]).then(([attnDays, oversightDays, roster, contributors]) => {
      if (!live) return;
      const nameOf = new Map(roster.map((e) => [e.user_id, e.name] as const));

      /**
       * Only people who can actually be absent.
       *
       * An Owner or Admin holds no `TimeTrackSelf` by construction, so they never clock in and the
       * nightly close resolves them to `absent` every single working day — which put "NeuroStack
       * Admin · Not clocked in" at the top of a manager's attention list, permanently, as though it
       * were a finding. It is not: they are not tracked, so there is nothing to attend to.
       *
       * Keyed on the **permission, not `is_owner`** — an owner who is also a contributor holds a
       * role granting `TimeTrackSelf` and should still appear. `useOversightAttendance` builds its
       * roster the same way; this widget was simply never given the same rule.
       */
      const tracked = new Set(
        roster
          .filter((e) => e.role_id && contributors?.has(e.role_id))
          .map((e) => e.user_id),
      );
      // Fail OPEN, never blank. A failed roles read (`contributors === null`) or an unreadable
      // roster leaves us unable to tell who is tracked — and dropping everyone would empty the
      // widget silently, which reads as "all clear" rather than "couldn't check".
      const canTell = contributors !== null && roster.length > 0;
      const isTracked = (userId: string) => !canTell || tracked.has(userId);

      // Not clocked in on the most recent closed workday.
      const closed = oversightDays.find((d) => d.users.length > 0);
      const absent: AttentionItem[] = (closed?.users ?? [])
        .filter((u) => u.status === "absent" && isTracked(u.user_id))
        .map((u) => ({
          userId: u.user_id,
          name: nameOf.get(u.user_id) ?? "An employee",
          reason: `Not clocked in · ${shortDay(closed!.date)}`,
          badge: "absent",
          tone: "bg-negative/10 text-negative",
          rank: 4,
        }));

      // Anomaly-flagged + low-score people from the most recent ranked day.
      const flagged: AttentionItem[] = (attnDays.find((p) => p.length > 0) ?? [])
        .filter(
          (p) => (p.anomaly_count > 0 || p.score <= LOW_SCORE) && isTracked(p.user_id),
        )
        .map((p) => {
          const hasAnomaly = p.anomaly_count > 0;
          return {
            userId: p.user_id,
            name: p.name,
            reason: hasAnomaly ? humanizeReason(p.reasons) : "Low productivity",
            badge: hasAnomaly ? p.top_severity || "flagged" : `${Math.round(p.score)}%`,
            tone: hasAnomaly ? severityTone(p.top_severity) : "bg-warning/10 text-warning",
            rank: hasAnomaly ? severityRank(p.top_severity) : 1,
          };
        });

      // One row per person (the most urgent reason wins), then rank-sorted and capped.
      const byUser = new Map<string, AttentionItem>();
      for (const it of [...absent, ...flagged]) {
        const prev = byUser.get(it.userId);
        if (!prev || it.rank > prev.rank) byUser.set(it.userId, it);
      }
      setItems([...byUser.values()].sort((a, b) => b.rank - a.rank).slice(0, 5));
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          <RowsSkeleton />
        ) : items.length === 0 ? (
          <WidgetEmpty
            icon={BellRing}
            title="Everyone's on track"
            body="No absences, no anomalies, no low scores. People appear here the moment one needs a look — nothing is fabricated."
          />
        ) : (
          items.map((it) => (
            <div key={it.userId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <TriangleAlert className="size-4 shrink-0 text-warning" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{it.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{it.reason}</p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  it.tone,
                )}
              >
                {it.badge}
              </span>
            </div>
          ))
        )}
        <ViewAllLink href="/insights/anomalies" label="Open anomalies" />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Upcoming deadlines (real data) --------------------------- */

/** One upcoming deadline — a personal task or a whole project. */
interface UpcomingItem {
  id: string;
  title: string;
  due: string;
  kind: "task" | "project";
  sub: string;
}

/**
 * Upcoming **deadlines**, soonest first: the viewer's own tasks (`GET /v1/me/tasks`) **and** the org's
 * projects with a near end-date (`GET /v1/projects` + `/v1/projects/{id}` for the date — bounded
 * fan-out). Real dates from the boards, never an invented schedule; overdue items live in Alerts above.
 */
export function UpcomingTasksWidget() {
  const [items, setItems] = useState<UpcomingItem[] | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [tasks, projects] = await Promise.all([
        listMyTasks().catch(() => [] as ApiMyTask[]),
        listProjects().catch(() => []),
      ]);
      // Project end-dates live on the detail item — pull them with a bounded fan-out (never a burst).
      const activeProjects = projects.filter((p) => p.status !== "completed").slice(0, 24);
      const details = await mapWithConcurrency(activeProjects, 3, (p) =>
        getProject(p.id).then(
          (d) => d,
          () => null,
        ),
      );
      if (!live) return;

      const taskItems: UpcomingItem[] = tasks
        // `closed` is as finished as `done` (the terminal post-review state) — without it, a
        // signed-off task with a future due date kept showing up as an upcoming deadline.
        .filter((t) => t.due && isOpenTaskStatus(t.status))
        .map((t) => ({
          id: `t-${t.id}`,
          title: t.title,
          due: t.due!,
          kind: "task",
          sub: t.status.replace(/_/g, " "),
        }));
      const projectItems: UpcomingItem[] = details
        .filter((d): d is NonNullable<typeof d> => Boolean(d?.end_date))
        .map((d) => ({
          id: `p-${d.id}`,
          title: d.name,
          due: d.end_date!,
          kind: "project",
          sub: "Project",
        }));

      const upcoming = [...taskItems, ...projectItems]
        .filter((i) => daysUntil(i.due) >= 0)
        .sort((a, b) => (a.due < b.due ? -1 : 1))
        .slice(0, 5);
      setItems(upcoming);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming deadlines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items === null ? (
          <RowsSkeleton />
        ) : items.length === 0 ? (
          <WidgetEmpty
            icon={CalendarClock}
            title="Nothing due soon"
            body="Your tasks and the org's projects with an upcoming deadline appear here. Open Projects to see every board."
          />
        ) : (
          items.map((i) => {
            const d = daysUntil(i.due);
            const Icon = i.kind === "project" ? FolderKanban : CheckSquare;
            return (
              <div key={i.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">{i.sub}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    d <= 1 ? "bg-warning/10 text-warning" : "bg-feature-tint text-primary",
                  )}
                >
                  {dueLabel(i.due)}
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
