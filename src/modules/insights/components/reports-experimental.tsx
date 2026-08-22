"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";
import { useAssistantStore } from "@/stores/assistant.store";
import { PeopleAttentionCard } from "./people-attention";
import { ReportsLibrary } from "./reports-library";
import { useAiReport } from "../use-reports";
import { useWeekPerformers } from "../use-week-performers";
import type { AiReport, NamedScore } from "../services/insights.service";

/**
 * AI reports — the AI-first executive surface in the preview's layout, fully live:
 *  • **AI briefing** + **workforce health** score (`GET /v1/insights/reports/ai`, entitlement-gated)
 *    — the AI-written org narrative, a real average-score ring, and the real day rollup. A 403 (the
 *    org lacks the AI Reports add-on) degrades to an honest upsell, not a failure.
 *  • **People to check in on** — the real attention ranking (`GET /v1/insights/attention`).
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
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function healthBand(score: number) {
  if (score >= 80) return { label: "Healthy", color: "var(--success)", text: "text-success" };
  if (score >= 65) return { label: "Stable", color: "var(--primary)", text: "text-primary" };
  if (score >= 50) return { label: "Watch", color: "var(--warning)", text: "text-warning" };
  return { label: "At risk", color: "var(--destructive)", text: "text-destructive" };
}

/* -------------------------------- component ------------------------------- */

export function ReportsExperimental() {
  // Default to today; client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(isoOf(new Date())), []);

  const today = isoOf(new Date());
  // This surface is day-scoped by design (its date pager steps days), so the daily artifact.
  const aiReport = useAiReport("daily", date);

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
            onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
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
            onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* ========================= EXECUTIVE OVERVIEW ======================== */}
      <ExecutiveOverview
        state={aiReport}
        date={date}
        onRegenerate={aiReport.regenerate}
        regenerating={aiReport.regenerating}
      />

      {/* ====================== PEOPLE TO CHECK IN ON ====================== */}
      {/* Shares the page's date rather than keeping its own — two pagers meant the executive
          summary above could be describing a different day from the list below, with nothing on
          screen saying so. */}
      <PeopleAttentionCard
        title="People to check in on"
        date={date}
        onDateChange={setDate}
      />

      {/* ============================ REPORT LIBRARY ========================== */}
      <ReportsLibrary />
    </div>
  );
}

/* --------------------------- executive overview --------------------------- */

function ExecutiveOverview({
  state,
  date,
  onRegenerate,
  regenerating,
}: {
  state: ReturnType<typeof useAiReport>;
  date: string;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  // Ranked over the week, not the day — a single day's roster is too small for "top" and "needs
  // attention" to be different people. Called before the early returns below, because hooks must run
  // in the same order on every render.
  const week = useWeekPerformers(date);

  if (state.locked) {
    return (
      <EmptyState
        icon={Lock}
        title="Requires the AI Reports add-on"
        description="The AI executive report is part of the AI Reports add-on (insights.reports.ai_pdf). Ask an owner to enable it to generate day-over-day AI briefings and PDF exports."
      />
    );
  }
  if (state.loading && !state.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-3xl border border-border bg-card">
        <Loader label="Generating the executive report…" />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="rounded-3xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        {state.error}
      </div>
    );
  }
  // This surface is daily-only, so `metrics` is always present in practice — the guard narrows
  // the hook's cross-granularity type rather than papering over a real absence.
  if (!state.data?.metrics) return null;

  const report = {
    date: state.data.date ?? "",
    metrics: state.data.metrics,
    narrative: state.data.narrative,
    generated_at: state.data.generated_at ?? 0,
  };
  const band = healthBand(report.metrics.avg_score ?? 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-12" data-tour="insights:ai">
        <AiBriefing
          report={report}
          onRegenerate={onRegenerate}
          regenerating={regenerating}
        />
        <HealthScoreCard report={report} band={band} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <NamedScoreList
          title="Top performers · this week"
          icon={TrendingUp}
          tone="up"
          people={week.topPerformers}
          emptyText={
            week.loading
              ? "Ranking the week…"
              : week.scoredPeople === 0
                ? "Nobody has been scored this week yet."
                : "Nobody scored above the attention threshold this week."
          }
        />
        <NamedScoreList
          title="Needs attention · this week"
          icon={TrendingDown}
          tone="down"
          people={week.needsAttention}
          emptyText={
            week.loading
              ? "Ranking the week…"
              : week.scoredPeople === 0
                ? "Nobody has been scored this week yet."
                : "Nobody is below the attention threshold this week."
          }
        />
      </div>
    </div>
  );
}

/* ------------------------------- AI briefing ------------------------------ */

function AiBriefing({
  report,
  onRegenerate,
  regenerating,
}: {
  report: AiReport;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const attention = report.metrics.needs_attention.slice(0, 3);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl bg-feature p-6 text-feature-foreground shadow-soft xl:col-span-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)" }}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-sm font-medium text-feature-foreground/90">
          <Sparkles className="size-4" /> Executive summary · {prettyDate(report.date)}
        </div>

        <Markdown className="mt-3 max-w-2xl text-[0.95rem] text-feature-foreground/90">
          {report.narrative}
        </Markdown>

        {attention.length > 0 ? (
          <div className="mt-5 space-y-2 border-t border-white/15 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-feature-foreground/70">
              Needs your attention
            </p>
            {attention.map((a) => (
              <div
                key={a.name}
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <TrendingDown className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-feature-foreground/85">
                  score {Math.round(a.score)}
                </span>
              </div>
            ))}
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
            <Button variant="secondary" size="sm" onClick={() => openAssistant()}>
              Ask the assistant <ArrowUpRight className="size-4" />
            </Button>
            <Button
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating}
              title="Regenerate summary"
              className="border-transparent bg-white/15 text-feature-foreground ring-1 ring-white/15 ring-inset hover:bg-white/25 disabled:opacity-70"
            >
              <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          </div>
          {formatGenerated(report.generated_at) ? (
            <p className="text-xs text-feature-foreground/70">
              Generated {formatGenerated(report.generated_at)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- health score card ---------------------------- */

const hrs = (h: number) => `${h.toFixed(1)}h`;

function HealthScoreCard({
  report,
  band,
}: {
  report: AiReport;
  band: { label: string; color: string; text: string };
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
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="size-4 text-primary" /> AI workforce health
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
            The team&apos;s average productivity score for the day, from reported activity.
          </p>
        </div>
      </div>

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
  icon: Icon,
  tone,
  people,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  tone: "up" | "down";
  people: NamedScore[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold">
        <Icon className={cn("size-4", tone === "up" ? "text-success" : "text-warning")} />
        {title}
      </div>
      {people.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y">
          {people.map((p, i) => (
            <div key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
              <Badge className={cn(tone === "up" ? "bg-success/12 text-success" : "bg-warning/15 text-warning")}>
                score {Math.round(p.score)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

