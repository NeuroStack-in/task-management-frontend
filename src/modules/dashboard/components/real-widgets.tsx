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
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  getAiReport,
  regenerateAiReport,
  getAiWeeklyReport,
  regenerateAiWeeklyReport,
  getAiMonthlyReport,
  regenerateAiMonthlyReport,
  getAttention,
  regenerateAttention,
} from "@/modules/insights/services/insights.service";
import { isoWeekOf } from "@/modules/insights/use-reports";
import type { DashboardRange } from "../lib/dashboard-data";
import {
  getDayOversight,
  type ApiDayResponse,
} from "@/modules/attendance/services/attendance.service";
import { useAssistantStore } from "@/stores/assistant.store";
import { useWorkdays } from "@/hooks/use-working-hours";
import { isWorkday, type IsoWeekday } from "@/lib/workdays";
import type { DashboardSummary } from "../use-dashboard-summary";

/** Yesterday in the caller's local calendar as `YYYY-MM-DD` — a completed, fully-closed day. */
function isoYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The most recent completed **workday** before today — org scores/attendance only exist on
 *  workdays, so the org summary reads this rather than a bare "yesterday" that may be a day off.
 *
 *  `workdays` is the org's configured schedule (ISO 1 = Mon … 7 = Sun). This skipped Sat/Sun
 *  unconditionally, so a Sun–Thu org asked for a report on a day nobody worked. */
function isoLastWorkday(workdays: readonly IsoWeekday[]): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // Bounded: a schedule always has at least one day (the API rejects an empty list), but don't
  // trust that enough to risk an unbounded loop here.
  for (let guard = 0; guard < 14 && !isWorkday(d, workdays); guard += 1) {
    d.setDate(d.getDate() - 1);
  }
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

function AiSummaryPending({ label }: { label: string }) {
  return (
    <div className="flex-1 space-y-2.5" aria-live="polite" aria-busy>
      <p className="flex items-center gap-2 text-feature-foreground/75">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        {label}
      </p>
      <div className="space-y-1.5" aria-hidden>
        <div className="h-2.5 w-full animate-pulse rounded-full bg-white/15" />
        <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-white/15 [animation-delay:120ms]" />
        <div className="h-2.5 w-8/12 animate-pulse rounded-full bg-white/15 [animation-delay:240ms]" />
      </div>
    </div>
  );
}

/** What period each range's narrative actually covers — stated on the card, because the KPIs
 *  beside it use slightly different windows (a rolling 7 days vs the ISO week). */
const PERIOD_NOTE: Record<DashboardRange, string> = {
  today: "last workday",
  "7d": "this ISO week",
  "30d": "this month",
  range: "",
};

/**
 * The org AI narrative, **following the dashboard's range control**.
 *
 * Narratives are pre-computed and cached per period, so the range maps onto whichever report
 * already covers it rather than summarising an arbitrary window:
 *
 * | Range   | Endpoint                          | Period |
 * |---------|-----------------------------------|--------|
 * | Today   | `/v1/insights/reports/ai`          | the last workday |
 * | Week    | `/v1/insights/reports/ai/weekly`   | the ISO week (Mon–Sun) |
 * | Month   | `/v1/insights/reports/ai/monthly`  | the calendar month |
 * | Custom  | — | no narrative exists for an arbitrary window |
 *
 * ⚠️ **Week is the ISO week, while the KPIs beside it cover a rolling 7 days.** Both are labelled
 * "this week" by `rangeLabelFor`, but on a Wednesday the narrative covers Mon–today and the KPIs
 * cover last Thursday–today. The card names its own period so the two aren't read as one window.
 */
export function OrgAiSummaryWidget({
  range = "today",
  rangeLabel,
}: {
  range?: DashboardRange;
  rangeLabel?: string;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const workdays = useWorkdays();
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A custom range has no cached narrative and no endpoint that would build one. Rather than
  // silently show yesterday's daily summary under a "Jun 3 – Jul 12" header — which would read as a
  // summary of that window — the card says what it can and can't cover.
  const unsupportedRange = range === "range";

  // Enterprise org report first (richer, carries generated_at); fall back to the attention narrative
  // (gated only on AiInsightsRead) when the org lacks the report entitlement. The attention
  // narrative is per-day only, so on a week/month range the fallback covers the last workday and the
  // period note below says so.
  //
  // `force` selects the POST `…/regenerate` twin of each read. The plain GETs serve the narrative
  // **cached server-side**, so re-reading them on Regenerate returned the identical prose instantly —
  // the button looked inert. The regenerate routes carry the same gates as their reads, so the same
  // 403 fallback applies.
  const fetchSummary = useCallback(
    async (force: boolean): Promise<{ narrative: string; generatedAt: number | null }> => {
      const date = isoLastWorkday(workdays);
      // The always-available fallback: the attention narrative for the last workday (gated only on
      // AiInsightsRead). Used when a period report has no entitlement OR hasn't been generated yet.
      const attentionFallback = async () => {
        const a = force ? await regenerateAttention(date) : await getAttention(date);
        return { narrative: a.narrative, generatedAt: null };
      };
      try {
        let r: { narrative: string; generated_at?: number | null } | null = null;
        if (range === "7d") {
          const week = isoWeekOf(date);
          r = force ? await regenerateAiWeeklyReport(week) : await getAiWeeklyReport(week);
        } else if (range === "30d") {
          const month = date.slice(0, 7);
          r = force ? await regenerateAiMonthlyReport(month) : await getAiMonthlyReport(month);
        } else {
          const rr = force ? await regenerateAiReport(date) : await getAiReport(date);
          return { narrative: rr.narrative, generatedAt: rr.generated_at };
        }
        // A weekly/monthly report can come back with **no narrative** for an incomplete period that
        // the scorer hasn't summarised yet (the current week is the common case) — treat that like a
        // missing report and fall back rather than showing a blank card.
        if (!r.narrative || !r.narrative.trim()) return attentionFallback();
        return { narrative: r.narrative, generatedAt: r.generated_at ?? null };
      } catch (e) {
        // 403 = no report entitlement; 404 = no report cached for this period yet. Both mean "use the
        // narrative we do have" rather than erroring the card.
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          return attentionFallback();
        }
        throw e;
      }
    },
    [workdays, range],
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    // No cached narrative exists for an arbitrary window, and there is no endpoint that would
    // build one — so don't fetch and don't show a different period's prose under this header.
    if (unsupportedRange) {
      setNarrative(null);
      setLoading(false);
      return;
    }
    fetchSummary(false)
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
  }, [fetchSummary, unsupportedRange]);

  async function regenerate() {
    if (regenerating || loading) return;
    setRegenerating(true);
    setError(null);
    try {
      const r = await fetchSummary(true);
      setNarrative(r.narrative);
      setGeneratedAt(r.generatedAt);
    } catch (e) {
      // Keep the previous narrative on screen — a failed re-run shouldn't blank a good summary.
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
          {PERIOD_NOTE[range] ? (
            <span className="text-[11px] font-normal text-feature-foreground/60">
              · {PERIOD_NOTE[range]}
            </span>
          ) : null}
        </CardTitle>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading || regenerating || unsupportedRange}
          title="Regenerate summary"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-feature-foreground/80 transition-colors hover:bg-white/15 hover:text-feature-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-feature-foreground/90">
        {loading || regenerating ? (
          <AiSummaryPending
            label={regenerating ? "Regenerating the summary…" : "Generating the org summary…"}
          />
        ) : unsupportedRange ? (
          <p className="flex-1 text-feature-foreground/75">
            Summaries are written per day, week and month, so there isn&apos;t one for a custom
            range. Switch to Today, Week or Month to read the narrative for that period.
          </p>
        ) : narrative ? (
          <>
            <p className="flex-1">{narrative}</p>
            {generatedAt ? (
              <p className="text-[11px] text-feature-foreground/60">
                Generated {new Date(generatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        ) : null}
        {error ? <p className="text-feature-foreground/70">{error}</p> : null}
        <button
          type="button"
          onClick={() =>
            openAssistant(
              `Summarise ${rangeLabel ?? "this week"}'s productivity and flag any burnout risks.`,
            )
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
      title="Activity heatmap"
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
