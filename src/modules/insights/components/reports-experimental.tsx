"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  Lock,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { formatDate, formatDateTime, formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";
import { isOwnerOf, useIsFeatureAllowed } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantStore } from "@/stores/assistant.store";
import { useAssistantAccess } from "@/hooks/use-assistant-access";
import { useAuthStore } from "@/stores/auth.store";
import { useEntitlementsStore } from "@/stores/entitlements.store";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { ReportsLibrary } from "./reports-library";
import { useAiReport, type AiReportLock } from "../use-reports";
import { useWeekPerformers, type RankedPerson } from "../use-week-performers";
import type { AiReport, NamedScore, PersonScore } from "../services/insights.service";
import { useScopedEmployee } from "./employee-scope-bar";
import { PersonAiReports } from "./person-analytics";
import { ALERTS_ANCHOR, AttentionPanel } from "./attention-panel";
import { PersonLink } from "./person-link";
import {
  canRegenerate,
  dailyReportProvenance,
  provenanceLine,
  type Provenance,
} from "../lib/ai-provenance";
import { resolvePerson } from "../lib/attention";
import { orgActivityFor } from "../lib/day-reads";
import { HEALTH_BANDS, LOW_SCORE_BELOW, healthBand, type HealthBand } from "../lib/thresholds";
import { useInsightsDate } from "../use-insights-params";

/**
 * AI reports — the AI-first executive surface in the preview's layout, fully live:
 *  • **Needs attention** ({@link AttentionPanel}) — first, because it is what the page is for: every
 *    attention signal for the page's day, each with its count, reason and link, and the people
 *    behind them (the Alerts block `/insights/anomalies` opens) — UX audit 2026-10-16, MON-03/MON-06.
 *  • **AI briefing** + **workforce health** score (`GET /v1/insights/reports/ai`) — the AI-written
 *    org narrative, a real average-score ring, and the real day rollup. It needs the "Export AI PDF
 *    report" and "View organization activity" permissions **and** the AI Reports add-on; a refusal
 *    says which one is missing, not a failure. The narrative wears AI branding only when a model
 *    wrote it; the health score is an average, so it doesn't (MON-08).
 *  • **People to check in on** moved to the Attendance page — absences and short days are acted on
 *    against the roster, and this tab is a reading surface.
 *  • **Report library** ({@link ReportsLibrary}) — the preview's full "All reports" surface, every
 *    report composed from real endpoints (real preview rows, real row/column counts, working
 *    CSV/PDF export). No mock; honest omission where a report needs a signal that doesn't exist yet.
 */

/* -------------------------------- date utils ------------------------------- */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
/**
 * When the report was written, or `null` when that isn't known.
 *
 * **`generated_at` is epoch milliseconds.** The backend stamps it with `now_ms()`, which is
 * `as_millis()`. This surface multiplied it by 1000 as though it were seconds, and rendered
 * "Generated 30/04/58610, 21:32:13" — a date thirty thousand years out, which is exactly what a
 * seconds/milliseconds mix-up looks like. The dashboard's copy of this line never had the bug, so
 * the two disagreed about the same field.
 *
 * `0` is the DTO's stand-in for "absent" (`generated_at: state.data.generated_at ?? 0`), and
 * `new Date(0)` is 1 Jan 1970 — a real-looking date for a report that was never stamped. Returning
 * null makes the caller drop the line instead.
 */
export function formatGenerated(ms: number): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  // The one date-time notation (UX audit XC-06 / MON-23), not the browser's raw `toLocaleString`.
  return Number.isNaN(d.getTime()) ? null : formatDateTime(d);
}

/** "Fri, 16 Oct 2026" — the one date notation (MON-23); this read "Friday, Oct 16". */
function prettyDate(iso: string): string {
  return formatDate(iso, { weekday: true });
}

/* -------------------------------- component ------------------------------- */

/**
 * The AI reports tab: one employee's AI recap when the hub is scoped to them (`?emp=`), the
 * organization's reports otherwise.
 */
export function ReportsExperimental() {
  const emp = useScopedEmployee();
  return emp ? <PersonAiReports userId={emp} /> : <OrgReports />;
}

function OrgReports() {
  // The day lives in the URL, shared with every Analytics tab (UX audit 2026-10-16, MON-13) —
  // today when absent, resolved client-side to avoid an SSR date mismatch.
  const [date, setDate, today] = useInsightsDate();
  // This surface is day-scoped by design (its date pager steps days), so the daily artifact.
  const aiReport = useAiReport("daily", date);

  // Publish the day's AI executive metrics to the assistant so questions about "this report" resolve
  // against the same headline figures. Date-scoped to the day the pager is on.
  const m = aiReport.data?.metrics;
  const topPerformer = m?.top_performers[0];
  useAssistantPageContext({
    date: date || null,
    facts: m
      ? [
          { label: "Report", value: "AI daily executive report" },
          { label: "Org avg score", value: m.avg_score === null ? "no data" : `${m.avg_score}%` },
          { label: "People scored", value: `${m.scored_people} of ${m.total_people}` },
          { label: "Active hours", value: formatHours(m.active_hours_total) },
          { label: "Productive hours", value: formatHours(m.productive_hours_total) },
          ...(topPerformer
            ? [{ label: "Top performer", value: `${topPerformer.name} (${topPerformer.score}%)` }]
            : []),
          { label: "Needs attention", value: String(m.needs_attention.length) },
        ]
      : [{ label: "Report", value: "AI daily executive report" }],
  });

  return (
    <div className="wp-enter space-y-8">
      {/* ================================ HEADER =============================== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">AI reports</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            An AI-written executive read of the workforce, plus every report you can open.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            disabled={!date}
            onClick={() => date && setDate(shiftIso(date, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <DatePicker
            value={date}
            max={today}
            onChange={setDate}
            className="w-40"
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            disabled={!date || date >= today}
            onClick={() => date && date < today && setDate(shiftIso(date, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* ============================ NEEDS ATTENTION ========================= */}
      {/* One answer to "what needs my attention", for the page's day, above everything else
          (MON-03) — and the Alerts block `/insights/anomalies` opens (MON-06). */}
      <AttentionPanel date={date} today={today} />

      {/* ========================= EXECUTIVE OVERVIEW ======================== */}
      <ExecutiveOverview
        state={aiReport}
        date={date}
        today={today}
        onRegenerate={aiReport.regenerate}
        regenerating={aiReport.regenerating}
      />

      {/* "People to check in on" now lives on the Attendance page. Absences and short days are
          something you act on against the roster, not something you read about here — and this tab
          is the reading surface. */}

      {/* ============================ REPORT LIBRARY ========================== */}
      {/* Follows the page's date (MON-05). */}
      <ReportsLibrary date={date} />
    </div>
  );
}

/* --------------------------- executive overview --------------------------- */

function ExecutiveOverview({
  state,
  date,
  today,
  onRegenerate,
  regenerating,
}: {
  state: ReturnType<typeof useAiReport>;
  date: string;
  today: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  // Ranked over the week, not the day — a single day's roster is too small for "top" and "needs
  // attention" to be different people. Called before the early returns below, because hooks must run
  // in the same order on every render. Not while the report is locked: the lists render under it, so
  // a week of reads behind a lock was spent on nothing (QA audit 2026-10-08, WP-492).
  const week = useWeekPerformers(state.locked ? "" : date);
  // The day's roster, to turn the report's bare names into links — the same shared read the
  // attention panel makes (see `lib/day-reads`), so it costs no extra request.
  const roster = useDayRoster(state.locked ? "" : date);

  if (state.locked) {
    return <ReportLocked reason={state.locked} />;
  }
  if (state.loading && !state.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-3xl border border-border bg-card">
        <Loader label="Generating the executive report…" />
      </div>
    );
  }
  if (state.error && !state.data) {
    // With a way back: `reload` existed and was wired to nothing, so only changing the date could
    // clear this (QA audit 2026-10-08, WP-278).
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        <p>{state.error}</p>
        <Button variant="outline" size="sm" onClick={state.reload}>
          Try again
        </Button>
      </div>
    );
  }
  // This surface is daily-only, so `metrics` is always present in practice — the guard narrows
  // the hook's cross-granularity type rather than papering over a real absence.
  if (!state.data?.metrics) return null;

  const report: AiReport = {
    date: state.data.date ?? "",
    metrics: state.data.metrics,
    narrative: state.data.narrative,
    generated_at: state.data.generated_at ?? 0,
    ai_generated: state.data.ai_generated,
    model: state.data.model,
  };
  const band = healthBand(report.metrics.avg_score ?? 0);
  const provenance = dailyReportProvenance(state.data);

  // "this week" only for the week that contains today — a past week's lists were titled "this week"
  // too (QA audit 2026-10-08, WP-487).
  const thisWeek = week.days.length === 0 || week.days.includes(today);
  const weekTitle = thisWeek ? "this week" : `week of ${shortDate(week.days[0])}`;
  const weekPhrase = thisWeek ? "this week" : "that week";

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-12" data-tour="insights:ai">
        <AiBriefing
          report={report}
          provenance={provenance}
          roster={roster}
          onRegenerate={onRegenerate}
          regenerating={regenerating}
          notice={
            state.regenError
              ? `Couldn't regenerate the summary, so this is the previous one. ${state.regenError}`
              : state.error
                ? "Couldn't refresh the report — showing the last one loaded."
                : null
          }
        />
        <HealthScoreCard report={report} band={band} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <NamedScoreList
          title={`Top performers · ${weekTitle}`}
          rule={`Average score ${LOW_SCORE_BELOW} or more over the days they were scored — the top three.`}
          icon={TrendingUp}
          tone="up"
          people={week.topPerformers}
          weekDays={week.days}
          emptyText={
            week.loading
              ? "Ranking the week…"
              : week.scoredPeople === 0
                ? thisWeek
                  ? "Nobody has been scored this week yet."
                  : "Nobody was scored that week."
                : `Nobody averaged ${LOW_SCORE_BELOW} or more ${weekPhrase}.`
          }
        />
        <NamedScoreList
          title={`Needs attention · ${weekTitle}`}
          rule={`Average score under ${LOW_SCORE_BELOW} over the days they were scored — the lowest three.`}
          icon={TrendingDown}
          tone="down"
          people={week.needsAttention}
          weekDays={week.days}
          emptyText={
            week.loading
              ? "Ranking the week…"
              : week.scoredPeople === 0
                ? thisWeek
                  ? "Nobody has been scored this week yet."
                  : "Nobody was scored that week."
                : `Nobody averaged under ${LOW_SCORE_BELOW} ${weekPhrase}.`
          }
        />
      </div>
    </div>
  );
}

/**
 * The org day rollup's people for `date` — the complete roster with each scored person's
 * breakdown. Empty while loading, on failure, and for an empty `date`: the names it resolves then
 * simply stay plain text.
 */
function useDayRoster(date: string): PersonScore[] {
  const scope = useAuthStore((s) => s.user?.id ?? "");
  const [people, setPeople] = useState<PersonScore[]>([]);
  useEffect(() => {
    setPeople([]);
    if (!date) return;
    let live = true;
    orgActivityFor(scope, date)
      .then((r) => live && setPeople(r.people))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [date, scope]);
  return people;
}

/** `2026-10-05` → `"5 Oct 2026"`, the one date notation (MON-23). */
function shortDate(iso: string): string {
  return formatDate(iso);
}

const AI_PDF_FEATURE = "insights.reports.ai_pdf";

/**
 * Why the executive report is unavailable, in terms of what would fix it — see `AiReportLock`.
 *
 * Every refusal used to read "Requires the AI Reports add-on … Ask an owner to enable it", including
 * for a role missing a permission on an org that already had the add-on, and for the owner who had
 * switched the add-on off (QA audit 2026-10-08, WP-277).
 */
function ReportLocked({ reason }: { reason: AiReportLock }) {
  const isFeatureAllowed = useIsFeatureAllowed();
  const loaded = useEntitlementsStore((s) => s.loaded);
  const allowed = useEntitlementsStore((s) => s.allowed.includes(AI_PDF_FEATURE));
  const switchedOn = useEntitlementsStore((s) => s.enabled[AI_PDF_FEATURE] === true);
  const isOwner = useAuthStore(isOwnerOf);
  const { can } = usePermissions();

  let title: string;
  let description: string;
  /** Where the viewer can fix it themselves, as a link (UX audit SET-15). */
  let fix: { label: string; href: string } | null = null;
  if (reason === "permission") {
    title = "Not included in your role";
    description =
      "The AI executive report needs a role with the “Export AI PDF report” and “View organization activity” permissions. An admin can add them under Settings → Roles & permissions.";
  } else if (reason === "unavailable") {
    title = "The AI executive report isn't available to you";
    description =
      "It needs the AI Reports add-on, and a role with the “Export AI PDF report” and “View organization activity” permissions.";
  } else if (loaded && !isFeatureAllowed(AI_PDF_FEATURE)) {
    title = "Requires the AI Reports add-on";
    description = `The AI executive report is part of the AI Reports add-on, which isn't in your organization's plan. ${
      can("billing:view")
        ? "Upgrading the plan adds it."
        : "Ask an owner to upgrade the plan."
    }`;
    if (can("billing:view")) fix = { label: "View plans", href: "/settings/billing" };
  } else if (loaded && allowed && !switchedOn) {
    title = "The AI Reports add-on is turned off";
    description =
      isOwner || can("entitlements:manage")
        ? "It's switched off for your organization. Turn it back on in Features to generate AI briefings."
        : "Your organization has switched it off. Ask an owner to turn it back on under Settings → Features.";
    if (isOwner || can("entitlements:manage")) fix = { label: "Open Features", href: "/settings/features" };
  } else {
    title = "Requires the AI Reports add-on";
    description =
      "The AI executive report needs the AI Reports add-on, which isn't active for your organization right now.";
  }
  return (
    <EmptyState
      icon={Lock}
      title={title}
      description={description}
      action={
        fix ? (
          <Button variant="outline" size="sm" render={<Link href={fix.href} />} nativeButton={false}>
            {fix.label}
          </Button>
        ) : undefined
      }
    />
  );
}

/* ------------------------------- AI briefing ------------------------------ */

function AiBriefing({
  report,
  provenance,
  roster,
  onRegenerate,
  regenerating,
  notice,
}: {
  report: AiReport;
  /** Who wrote the narrative — the AI mark only when a model did (MON-08). */
  provenance: Provenance;
  /** The day's people — to link a name from a server that predates `NamedScore.user_id`. */
  roster: PersonScore[];
  onRegenerate: () => void;
  regenerating: boolean;
  /** A failed re-run or refresh — said here, beside the summary it kept. */
  notice?: string | null;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  // The floating assistant's own gate — a button it can't answer is a button that does nothing.
  const canAsk = useAssistantAccess().chat;
  const attention = report.metrics.needs_attention.slice(0, 3);
  const isAi = provenance.kind === "ai";
  /**
   * A re-run can change the text when a model wrote it — or when the server wrote the line itself
   * over a scored day (the provider was down), which a retry may turn into the model's. Never over
   * an unscored day: that fixed line is the whole answer — and never, whatever the payload claims,
   * without someone scored to analyse (the one Regenerate rule, UX audit MON-21).
   */
  const canRerun =
    canRegenerate(report.metrics.scored_people > 0, report.narrative) &&
    (isAi || (provenance.kind === "computed" && report.ai_generated === false));

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl bg-feature p-6 text-feature-foreground shadow-soft xl:col-span-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)" }}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-sm font-medium text-feature-foreground/90">
          {/* The sparkle only over text a model wrote; the fixed line for an unscored day is a
              summary of the figures, and says so (MON-08). */}
          {isAi ? (
            <Sparkles className="size-4" aria-hidden="true" />
          ) : (
            <FileText className="size-4" aria-hidden="true" />
          )}
          {isAi ? "AI executive summary" : "Summary"} · {prettyDate(report.date)}
        </div>

        {/* Bold and headings re-inked for the feature surface — see `AiReportCard`. */}
        <Markdown
          className="mt-3 max-w-2xl text-[0.95rem] text-feature-foreground/90 [&_.text-foreground]:text-feature-foreground"
          links="same-origin"
        >
          {report.narrative}
        </Markdown>

        {attention.length > 0 ? (
          <div className="mt-5 space-y-2 border-t border-white/15 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-feature-foreground/85">
              Lowest scores this day · under {LOW_SCORE_BELOW}
            </p>
            {attention.map((a, i) => (
              <div
                // Index too: two people can share a name, and a name-only key collided.
                key={`${a.name}-${i}`}
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <TrendingDown className="size-4" aria-hidden="true" />
                </span>
                {/* A link to the person and their day (MON-04) — by the id the report sends, or, from
                    a server that predates it, by matching the name to the day's roster (text if it
                    could be two people). */}
                <PersonLink
                  userId={resolveNamed(a, roster)}
                  name={a.name}
                  date={report.date}
                  tone="onFeature"
                  className="min-w-0 flex-1 text-sm"
                />
                <span className="shrink-0 text-xs font-medium tabular-nums text-feature-foreground/85">
                  score {Math.round(a.score)}
                </span>
              </div>
            ))}
            {/* What drove each score — and anyone else below the line — is in Needs attention. */}
            <a
              href={`#${ALERTS_ANCHOR}`}
              className="inline-block text-xs font-medium text-feature-foreground underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              Why, and everyone below {LOW_SCORE_BELOW} →
            </a>
          </div>
        ) : null}

        <div className="mt-5 flex-1" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Both actions belong to *this summary*, so they sit on it — the same arrangement the
              dashboard's AI summary card uses. Regenerate was in the page header beside the date
              pager, which read as a page-level control and put it a long way from the text it
              rewrites.

              The day's narrative is generate-once-cached, so each press is a fresh billed model
              run against the org's daily token budget. */}
          <div className="flex flex-wrap items-center gap-2">
            {canAsk ? (
              <Button variant="secondary" size="sm" onClick={() => openAssistant()}>
                Ask the assistant <ArrowUpRight className="size-4" />
              </Button>
            ) : null}
            {/* Only where a re-run (a billed model call) could change the text — see `canRerun`. */}
            {canRerun ? (
              <Button
                size="sm"
                onClick={onRegenerate}
                disabled={regenerating}
                title={isAi ? "Regenerate summary" : "Try writing this summary with AI again"}
                className="border-transparent bg-white/15 text-feature-foreground ring-1 ring-white/15 ring-inset hover:bg-white/25 disabled:opacity-70"
              >
                <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
                {regenerating ? "Regenerating…" : isAi ? "Regenerate" : "Try AI again"}
              </Button>
            ) : null}
          </div>
          {/* "AI-generated · time · may be wrong", or that this one isn't AI at all (MON-08). */}
          <p className="text-xs text-feature-foreground/85">{provenanceLine(provenance)}</p>
        </div>
        {notice ? (
          <p className="mt-3 text-xs text-feature-foreground/80" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------- health score card ---------------------------- */

const hrs = (h: number) => formatHours(h);

function HealthScoreCard({
  report,
  band,
}: {
  report: AiReport;
  band: HealthBand;
}) {
  const m = report.metrics;
  const drivers: { label: string; value: string }[] = [
    { label: "People scored", value: `${m.scored_people}/${m.total_people}` },
    { label: "Active hours", value: hrs(m.active_hours_total) },
    { label: "Productive hours", value: hrs(m.productive_hours_total) },
    {
      label: "Needs attention",
      value: `${m.needs_attention.length}`,
    },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-soft xl:col-span-4">
      {/* Not "AI workforce health": it is an average of the day's scores, computed, and an AI mark
          on it claimed a judgement nobody made (MON-08). */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Gauge className="size-4 text-primary" aria-hidden="true" /> Workforce health
      </div>

      <div className="flex items-center gap-5">
        {m.avg_score === null ? (
          <RadialScore value={0} color="var(--muted-foreground)" placeholder />
        ) : (
          <RadialScore value={m.avg_score} color={band.color} />
        )}
        <div className="min-w-0">
          <p className={cn("font-heading text-lg font-semibold", m.avg_score === null ? "text-muted-foreground" : band.text)}>
            {m.avg_score === null ? "No scores" : band.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The team&apos;s average productivity score for the day — computed from reported
            activity, not written by AI.
          </p>
        </div>
      </div>

      {/* The bands, where they are used (MON-18). They share the 60 line with "Needs attention",
          so "At risk" means the same thing one level up. */}
      <ul aria-label="Health bands" className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {HEALTH_BANDS.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: b.color }} />
            <span className={cn(m.avg_score !== null && b.key === band.key && "font-semibold text-foreground")}>
              {b.label} {b.range}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
        {drivers.map((d) => (
          <div key={d.label} className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{d.label}</p>
            <span className="font-display text-lg font-semibold tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-circle score ring — colour follows the health band. */
function RadialScore({
  value,
  color,
  placeholder,
}: {
  value: number;
  color: string;
  placeholder?: boolean;
}) {
  const size = 116;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - clamped / 100);
  const center = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={center} cy={center} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        {!placeholder ? (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold leading-none tabular-nums">
          {placeholder ? "—" : Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

/* ----------------------------- named score list --------------------------- */

function NamedScoreList({
  title,
  rule,
  icon: Icon,
  tone,
  people,
  weekDays,
  emptyText,
}: {
  title: string;
  /** Who makes the list, in words — the threshold it applies (MON-18). */
  rule: string;
  icon: LucideIcon;
  tone: "up" | "down";
  people: RankedPerson[];
  /** The days ranked — the last one is the day the screenshots link opens. */
  weekDays: string[];
  emptyText: string;
}) {
  const lastDay = weekDays[weekDays.length - 1];
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon
            className={cn("size-4", tone === "up" ? "text-primary" : "text-warning")}
            aria-hidden="true"
          />
          {title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{rule}</p>
      </div>
      {people.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y">
          {people.map((p) => {
            // What drove the week's score: the weakest parts for someone needing attention, the
            // strongest for a top performer — averaged over the days they were scored (MON-04).
            const drivers = tone === "up" ? [...p.drivers].reverse().slice(0, 2) : p.drivers.slice(0, 2);
            return (
              <div key={p.userId} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0 space-y-0.5">
                  <PersonLink userId={p.userId} name={p.name} date={lastDay} className="text-sm font-medium" />
                  {drivers.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {tone === "up" ? "Strongest: " : "Weakest: "}
                      {drivers.map((d) => `${d.label} ${d.value}`).join(" · ")}
                      {` · ${p.days} ${p.days === 1 ? "day" : "days"} scored`}
                    </p>
                  ) : null}
                </div>
                {/* Indigo and amber, not green and red — a pair colour-blind readers can tell
                    apart (MON-16); the list title says which is which anyway. */}
                <Badge className={cn("shrink-0", tone === "up" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning")}>
                  score {Math.round(p.score)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Who a report's named person is: the `user_id` the server sends (MON-04). A server that predates
 * the field sends the name alone, and then it is matched to the day's roster — `null` unless exactly
 * one person has that name (and, when two do, that score).
 */
function resolveNamed(n: NamedScore, roster: PersonScore[]): string | null {
  if (n.user_id) return n.user_id;
  return (
    resolvePerson(n.name, roster, (p) => p.breakdown?.score ?? null, n.score)?.user_id ?? null
  );
}
