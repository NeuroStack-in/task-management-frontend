"use client";

/**
 * The org dashboard's **real** widget cards — every figure here comes from a live endpoint
 * (employees, projects, billing). Kept in their own file (no imports from the registry or the
 * customizable shell) so the registry can import them without a cycle.
 *
 * The one honest exception is {@link MonitoringPendingCard}: the activity metrics it lists need the
 * desktop agent, which isn't reporting, so it states what's missing instead of seeding fake charts.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FolderKanban,
  CreditCard,
  Building2,
  Activity,
  ArrowUpRight,
  Sparkles,
  CalendarCheck,
  Grid3x3,
  Users,
  Trophy,
  BellRing,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  getDailySummary,
  regenerateDailySummary,
  getAiReport,
  getAttention,
  type DailySummary,
} from "@/modules/insights/services/insights.service";
import {
  getDayOversight,
  type ApiDayResponse,
} from "@/modules/attendance/services/attendance.service";
import { useAssistantStore } from "@/stores/assistant.store";
import type { DashboardSummary } from "../use-dashboard-summary";

/** Yesterday in the caller's local calendar as `YYYY-MM-DD` — a completed, fully-closed day. */
function isoYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The most recent completed **workday** (Mon–Fri) before today — org scores/attendance only exist on
 *  workdays, so the org summary reads this rather than a bare "yesterday" that may be a weekend. */
function isoLastWorkday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); // skip Sun/Sat
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this data.";
    return e.message;
  }
  return fallback;
}

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

/* ------------------------------ Projects overview ----------------------------- */

export function ProjectsOverviewCard({ p }: { p: DashboardSummary["projects"] }) {
  const rows: { label: string; value: string | number; tone?: string }[] = [
    { label: "Active", value: p.active },
    { label: "On hold", value: p.onHold },
    { label: "Completed", value: p.completed },
    { label: "Open tasks", value: p.kpiCoverage ? p.openTasks : "—" },
    {
      label: "Overdue",
      value: p.kpiCoverage ? p.overdue : "—",
      tone: p.overdue > 0 ? "text-destructive" : undefined,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <FolderKanban className="size-4" />
          </span>
          Projects overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl font-semibold tabular-nums">{p.total}</p>
          <p className="text-xs text-muted-foreground">
            {p.avgCompletion === null
              ? "completion pending"
              : `${p.avgCompletion}% avg completion`}
          </p>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium tabular-nums ${r.tone ?? ""}`}>{r.value}</span>
            </li>
          ))}
        </ul>
        {p.kpiCoverage < p.total ? (
          <p className="text-[11px] text-muted-foreground">
            Task metrics cover {p.kpiCoverage}/{p.total} projects (KPIs still computing for the rest).
          </p>
        ) : null}
        <ViewAllLink href="/projects" label="All projects" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Department headcount ----------------------------- */

export function DepartmentHeadcountCard({
  departments,
}: {
  departments: DashboardSummary["employees"]["byDepartment"];
}) {
  const total = departments.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Building2 className="size-4" />
          </span>
          Headcount by department
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          departments.slice(0, 6).map((d) => {
            const pct = Math.round((d.count / total) * 100);
            return (
              <div key={d.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{d.name}</span>
                  <span className="font-medium tabular-nums">
                    {d.count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
        <ViewAllLink href="/employees" label="All employees" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Billing (real) ----------------------------- */

export function BillingCard({ billing }: { billing: DashboardSummary["billing"] }) {
  if (!billing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CreditCard className="size-4" />
            </span>
            Billing overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Billing isn&apos;t available for your account.
          </p>
          <ViewAllLink href="/billing" label="Manage billing" />
        </CardContent>
      </Card>
    );
  }
  // A plan with no seat cap set (e.g. free) reports `seat_cap: 0` — don't render "3 / 0" or a bogus
  // 0% bar; show the raw usage instead.
  const capped = billing.seatCap > 0;
  const pct = capped ? Math.round((billing.seatsUsed / billing.seatCap) * 100) : 0;
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
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="font-display text-xl font-semibold capitalize">{billing.plan}</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {billing.status}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Seats used</span>
            <span className="tabular-nums">
              {capped ? `${billing.seatsUsed} / ${billing.seatCap}` : `${billing.seatsUsed} in use`}
            </span>
          </div>
          {capped ? (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No seat cap on this plan.</p>
          )}
        </div>
        <ViewAllLink href="/billing" label="Manage billing" />
      </CardContent>
    </Card>
  );
}

/* --------------------- Activity monitoring pending (honest) -------------------- */

export function MonitoringPendingCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Activity className="size-4" />
          </span>
          Activity monitoring
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3 text-sm text-muted-foreground">
        <p className="flex-1 leading-relaxed">
          Productivity scores, tracked hours, attendance rates, screenshots and per-team trends come
          from the desktop agent&apos;s activity data. The agent isn&apos;t reporting yet, so these
          are intentionally blank rather than estimated — they&apos;ll populate here once monitoring
          is live.
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {["Productivity", "Hours tracked", "Attendance rate", "Screenshots", "Heatmap", "Team comparison"].map(
            (m) => (
              <li key={m} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                {m}
              </li>
            ),
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ AI daily summary (real) ----------------------------- */

/** Attendance status slug → human label (shared by the AI summary + attendance cards). */
const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  partial: "Partial",
  absent: "Absent",
  leave: "On leave",
  non_workday: "Non-workday",
  // The day-close cron (00:15 UTC) stamps the AttendanceDay; until it runs the server returns
  // `unknown` for that day — show it as pending rather than a misleading "Absent".
  unknown: "Pending close",
};

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <p className="font-display text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * The caller's AI daily briefing — self-fetching. Pulls `GET /v1/me/insights/summary?date=` for
 * yesterday (a completed day) and renders the AI `narrative` prominently plus a few key metrics.
 * **Real, and works without the desktop agent:** the summary is derived from attendance + timesheet;
 * the deterministic productivity `score` is present only on days the agent reported activity.
 */
/** "Generated 12 Jul, 14:30" — absolute local time; the narrative is cached, so this is when it was
 *  last (re)generated. Only ever rendered client-side (data arrives via useEffect), so no SSR skew. */
function formatGeneratedAt(ms?: number): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

export function AiDailySummaryCard() {
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getDailySummary(isoYesterday())
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorMessage(e, "Couldn't load your daily summary.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true);
    setError(null);
    try {
      const fresh = await regenerateDailySummary(isoYesterday());
      setData(fresh);
    } catch (e) {
      setError(errorMessage(e, "Couldn't regenerate the summary."));
    } finally {
      setRegenerating(false);
    }
  }

  const m = data?.metrics;
  const generatedAt = formatGeneratedAt(data?.generated_at);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Sparkles className="size-4" />
          </span>
          AI daily summary
        </CardTitle>
        {/* Regenerate: the narrative is cached server-side, so this is the only way to refresh it. */}
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={loading || regenerating}
          title="Regenerate summary"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader label="Generating your briefing…" />
        ) : error ? (
          <p className="py-6 text-sm text-muted-foreground">{error}</p>
        ) : data && m ? (
          <>
            <div className="flex gap-2.5 rounded-lg bg-feature-tint/60 p-3 text-sm text-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="leading-relaxed">{data.narrative}</p>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              <li>
                {/* Live timer total from the day's TIME# entries — real the moment a session folds.
                    (Not `worked_minutes`, which is the attendance-official figure and stays 0 until
                    the 00:15 close cron stamps the AttendanceDay.) */}
                <MetricTile label="Hours tracked" value={(m.tracked_secs / 3600).toFixed(1)} />
              </li>
              <li>
                <MetricTile label="Tasks" value={m.task_count} />
              </li>
              <li>
                <MetricTile
                  label={m.late ? "Attendance (late)" : "Attendance"}
                  value={ATTENDANCE_LABEL[m.attendance] ?? m.attendance}
                />
              </li>
              <li>
                <MetricTile
                  label="Productivity"
                  value={data.score ? `${Math.round(data.score.score)}/100` : "—"}
                />
              </li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Briefing for {data.date}
              {generatedAt ? ` · generated ${generatedAt}` : ""}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Org AI summary (real) ------------------------------- */

/**
 * The preview's teal "AI summary" card, on **real** data. Pulls the org day's AI narrative
 * (`GET /v1/insights/reports/ai`; falls back to the broadly-available attention narrative when the
 * org isn't on the Enterprise report), with a **Regenerate** button that re-runs the model and the
 * preview's "Ask the assistant" CTA. Reads yesterday — the last day the close cron has resolved.
 */
export function OrgAiSummaryWidget() {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enterprise org report first (richer, carries generated_at); fall back to the attention narrative
  // (gated only on AiInsightsRead) when the org lacks the report entitlement.
  const fetchSummary = useCallback(async (): Promise<{
    narrative: string;
    generatedAt: number | null;
  }> => {
    try {
      const r = await getAiReport(isoLastWorkday());
      return { narrative: r.narrative, generatedAt: r.generated_at };
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        const a = await getAttention(isoLastWorkday());
        return { narrative: a.narrative, generatedAt: null };
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetchSummary()
      .then((r) => {
        if (!live) return;
        setNarrative(r.narrative);
        setGeneratedAt(r.generatedAt);
      })
      .catch((e) => live && setError(errorMessage(e, "Couldn't load the AI summary.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [fetchSummary]);

  async function regenerate() {
    if (regenerating || loading) return;
    setRegenerating(true);
    setError(null);
    try {
      const r = await fetchSummary();
      setNarrative(r.narrative);
      setGeneratedAt(r.generatedAt);
    } catch (e) {
      setError(errorMessage(e, "Couldn't regenerate the summary."));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> AI summary
        </CardTitle>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading || regenerating}
          title="Regenerate summary"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-feature-foreground/80 transition-colors hover:bg-white/15 hover:text-feature-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-feature-foreground/90">
        {loading ? (
          <p className="flex-1 text-feature-foreground/70">Generating the org summary…</p>
        ) : error ? (
          <p className="flex-1 text-feature-foreground/70">{error}</p>
        ) : (
          <>
            <p className="flex-1">{narrative}</p>
            {generatedAt ? (
              <p className="text-[11px] text-feature-foreground/60">
                Generated {new Date(generatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        )}
        <button
          type="button"
          onClick={() =>
            openAssistant("Summarise this week's productivity and flag any burnout risks.")
          }
          className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
        >
          Ask the assistant <ArrowUpRight className="size-3.5" />
        </button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Attendance today (real) ----------------------------- */

const ATTENDANCE_TONE: Record<string, string> = {
  present: "var(--success)",
  partial: "var(--warning)",
  absent: "var(--destructive)",
  leave: "var(--muted-foreground)",
};

/**
 * Org attendance for a completed day — self-fetching. Pulls `GET /v1/attendance/day?date=` for
 * yesterday (the 00:15 close cron only publishes closed days) and shows present / partial / absent /
 * leave counts. **Real** (needs `AttendanceReadTeam`; a caller without it gets an honest 403 note).
 * `late` isn't on the GSI3 index this route reads, so it isn't broken out here — the personal
 * timesheet is where per-session detail lives.
 */
export function AttendanceTodayCard() {
  const [data, setData] = useState<ApiDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getDayOversight(isoYesterday())
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorMessage(e, "Couldn't load attendance.")))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const s = data?.summary;
  const rows: { key: string; count: number }[] = s
    ? [
        { key: "present", count: s.present },
        { key: "partial", count: s.partial },
        { key: "absent", count: s.absent },
        { key: "leave", count: s.leave },
      ]
    : [];
  const denom = s?.counted || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <CalendarCheck className="size-4" />
          </span>
          Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader label="Loading attendance…" />
        ) : error ? (
          <p className="py-6 text-sm text-muted-foreground">{error}</p>
        ) : s && s.counted > 0 ? (
          <>
            <div className="flex items-end justify-between">
              <p className="font-display text-3xl font-semibold tabular-nums">{s.present}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round((s.present / denom) * 100)}% of {s.counted} present
              </p>
            </div>
            {rows.map((r) => {
              const pct = Math.round((r.count / denom) * 100);
              return (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{ATTENDANCE_LABEL[r.key]}</span>
                    <span className="font-medium tabular-nums">
                      {r.count} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: ATTENDANCE_TONE[r.key] }}
                    />
                  </div>
                </div>
              );
            })}
            <ViewAllLink href="/attendance" label="Attendance calendar" />
          </>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">
            No attendance has been recorded for {data?.date ?? "this day"} yet — the close job
            publishes each day&apos;s verdict shortly after it ends.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------- Agent-pending widgets (honest placeholders) -------------------- */

/**
 * Shared honest-placeholder shell for widgets whose figures come from the **desktop agent** — which
 * isn't reporting yet. Mirrors {@link MonitoringPendingCard}'s treatment: state what's missing and
 * what will appear, never a seeded number.
 */
function AgentPendingCard({
  title,
  icon: Icon,
  detail,
  metrics,
}: {
  title: string;
  icon: LucideIcon;
  detail: string;
  metrics: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3 text-sm text-muted-foreground">
        <p className="flex-1 leading-relaxed">{detail}</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {metrics.map((mtc) => (
            <li key={mtc} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              {mtc}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ProductivityHeatmapPendingCard() {
  return (
    <AgentPendingCard
      title="Productivity heatmap"
      icon={Grid3x3}
      detail="Hourly activity intensity across the week — showing when the team is most productive — appears here once the desktop agent starts reporting captured activity."
      metrics={["Hour-of-day intensity", "Day-of-week bands", "Peak focus windows", "Quiet periods"]}
    />
  );
}

export function TeamComparisonPendingCard() {
  return (
    <AgentPendingCard
      title="Team comparison"
      icon={Users}
      detail="Per-team productivity, tracked hours and attendance side by side — so you can compare teams at a glance — populates once the desktop agent reports activity data."
      metrics={["Productivity by team", "Tracked hours", "Attendance rate", "Team trends"]}
    />
  );
}

export function TopPerformersPendingCard() {
  return (
    <AgentPendingCard
      title="Top performers"
      icon={Trophy}
      detail="The highest-scoring people for the day, ranked by the deterministic productivity score, will list here once the desktop agent's activity data feeds the scorer."
      metrics={["Score leaders", "Most focused", "Consistency streaks", "Rising this week"]}
    />
  );
}

export function RecentAlertsPendingCard() {
  return (
    <AgentPendingCard
      title="Recent alerts"
      icon={BellRing}
      detail="Anomaly alerts — overtime, idle stretches, burnout risk and policy concerns — surface here once the desktop agent reports and the scorer flags them. No alerts are fabricated."
      metrics={["Overtime / after-hours", "Idle stretches", "Burnout risk", "Policy concerns"]}
    />
  );
}
