"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAssistantPageContext } from "@/stores/page-context.store";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodFilter, type Granularity } from "@/components/shared/period-filter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ActiveInactiveRing } from "@/modules/dashboard/components/insight-widgets";
import { ApiError } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DepartmentScoreFocus } from "./department-score-focus";
import { useOrgActivity } from "../use-activity";
import { useOrgActivityRange } from "../use-activity-range";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
import { useHourlyActivity } from "../use-hourly-activity";
import { getAppUsage, type UsageRow } from "../services/insights.service";
import { useScopedEmployee } from "./employee-scope-bar";
import { PersonActivity } from "./person-analytics";
import {
  CHART_MARGIN,
  CHART_MARGIN_WITH_LEGEND,
  xAxisLabel,
  yAxisLabel,
} from "@/components/shared/chart-axis";
import { useWorkdays } from "@/hooks/use-working-hours";
import { isWorkday, type IsoWeekday } from "@/lib/workdays";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";
// The org's own week, not a Monday one (QA audit 2026-10-08, WP-487).
import { weekStartIso, weekStartOf, weekWorkdays } from "../lib/week";
import { countOf } from "../lib/plural";
import { useInsightsDate, useInsightsDept } from "../use-insights-params";
import { CaptureEmptyState } from "./capture-empty-state";
import { ChartTable } from "./chart-table";

/**
 * Activity — the preview's Analytics layout (granularity toggle · AI report card · activity area
 * chart · time-by-category · active/inactive ring · app & website breakdown) wired to the real
 * productivity-score read models (LLD §12), element-for-element. Where the server has a real source
 * the element shows it; where it doesn't yet, the element degrades to an honest empty **in place**
 * rather than being removed or fabricated — and a **failed** read says it failed, never that the
 * period was empty:
 *  • Time by category / active-vs-inactive ring — real, and **scoped to the selected granularity**:
 *    the day's rollup for Daily, an aggregate of the period's per-day rollups for Weekly/Monthly.
 *  • AI narrative — `DepartmentScoreFocus` (`GET /v1/insights/reports/dept-summary`, the
 *    `ai.insights` feature), org-wide or per department.
 *  • Weekly / Monthly trend — real, aggregated from per-day org rollups (fan-out, concurrency 3),
 *    over the org's scheduled days up to today.
 *  • Daily trend — real, from the day's **screenshot captures** (`captured_at` + the AI's check of
 *    each frame), bucketed into local hours. The scorer stores daily totals so there is no hourly
 *    *score*; captures are a real record of when work happened, and are labelled as moments rather
 *    than minutes.
 *
 * **Colours never pass a verdict the AI didn't make** (UX audit 2026-10-16, MON-07 / XC-08). The
 * hourly curve and the app panels were red "Distracting" by the org's **app-name** rules, against
 * the owner's decision of 2026-10-13 that app names decide nothing — the same frame could be red
 * here and unflagged on Screenshots. The hourly curve now splits by the AI's check (the Screenshots
 * tab's own verdict); the app-rule panels, which have no AI equivalent, are labelled "By your app
 * rules (not AI)" and drawn in one neutral hue, darkest for "productive", with no red.
 *  • App & website breakdown — real (`GET /v1/insights/apps/usage`), the per-app and per-site time
 *    the agents reported over the same window as the chart.
 */

const CHART_TITLE: Record<Granularity, string> = {
  daily: "Activity by hour",
  // Weekly/monthly plot the productivity SCORE, not activity. They were both titled "Activity by
  // …" over a series labelled "Active %", so a 70 read as "70% active" when it is 70 points of a
  // four-term score. Two different quantities cannot share one label.
  weekly: "Productivity score by day",
  monthly: "Productivity score by week",
};

/** Sub-title per granularity — names the unit the axis is in. */
const CHART_SUBTITLE: Record<Granularity, string> = {
  daily: "Captures per hour, by the AI's check of each screenshot",
  weekly: "Score out of 100 · one point per day",
  monthly: "Score out of 100 · one point per week",
};

/**
 * A neutral grey at `pct`% ink — the text colour mixed into the card surface. Built from those two
 * tokens rather than a `--chart-*` slot because the chart slots change meaning by palette: one
 * palette's `--chart-3` is red, another's `--chart-1` coral, another's `--chart-5` blue. The ink and
 * the surface are neutral in every palette and both themes.
 */
const ink = (pct: number) => `color-mix(in srgb, var(--foreground) ${pct}%, var(--card))`;

/**
 * The hourly curve's bands: the AI's verdict on each capture — the Screenshots tab's own, so a frame
 * reads the same on both pages (MON-07). Amber (the status token, amber in every palette) only for
 * what the AI actually flagged, with a label; light grey and a dashed line for "no verdict yet",
 * which is not "fine" — the dash keeps the two greys apart without relying on colour.
 */
const HOUR_VERDICTS = [
  { key: "ok", label: "Fine for their role (AI)", color: ink(80), dash: undefined },
  { key: "unchecked", label: "Not checked by AI yet", color: ink(35), dash: "4 3" },
  { key: "flagged", label: "Flagged by AI", color: "var(--warning)", dash: undefined },
] as const;

/**
 * The org's **app-rule** categories as one neutral grey stepped by lightness — an ordered scale
 * (productive → neutral → distracting), not a good/bad green–red verdict, because these come from
 * app names, which the AI review deliberately ignores (MON-07). Validated as an ordinal ramp against
 * the light and dark card surfaces.
 */
const APP_RULE_COLOR = {
  productive: ink(80),
  neutral: ink(55),
  distracting: ink(35),
} as const;

const CATEGORIES = [
  { key: "productive", label: "Productive", color: APP_RULE_COLOR.productive },
  { key: "neutral", label: "Neutral", color: APP_RULE_COLOR.neutral },
  { key: "distracting", label: "Distracting", color: APP_RULE_COLOR.distracting },
] as const;

const fmtHours = (sec: number): string => formatDuration(sec);

// ── date helpers ──────────────────────────────────────────────────────────────
function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** All the org's **scheduled** ISO dates in the month containing `anchor`. */
function monthWorkdays(anchor: string, workdays: readonly IsoWeekday[]): string[] {
  const d = parseIso(anchor);
  const year = d.getFullYear();
  const month = d.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) {
    const cur = new Date(year, month, day);
    if (isWorkday(cur, workdays)) out.push(isoOf(cur));
  }
  return out;
}

/**
 * The Activity tab: one employee's view when the hub is scoped to them (`?emp=`, from the profile's
 * Analytics button), the organization's otherwise.
 */
export function ActivityTab() {
  const emp = useScopedEmployee();
  return emp ? <PersonActivity userId={emp} /> : <OrgActivityTab />;
}

function OrgActivityTab() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  // The day — and the summary's department — live in the URL, shared with every Analytics tab, so
  // switching tabs keeps them (UX audit 2026-10-16, MON-13). Today when absent, resolved after
  // mount (no SSR/client date mismatch). Today may read partial until the overnight close scores it.
  const [date, setDate, today] = useInsightsDate();
  const [dept, setDept] = useInsightsDept();
  const [showUsage, setShowUsage] = useState(false);
  const anchor = date || today;

  // Only Daily reads the single-day rollup; Weekly/Monthly aggregate their own range below, so
  // fetching (and polling) the day there was a request for a figure nothing on screen used.
  const org = useOrgActivity(granularity === "daily" ? date : "");
  // No `useAiReport` here any more. The org-wide `reports` narrative was what the old blue banner
  // rendered; `DepartmentScoreFocus` now owns the page's one summary and fetches its own. Leaving
  // this call would keep paying for a second generation nothing displays.
  const workdays = useWorkdays();

  /**
   * The arrows beside the date step by the granularity — a day, a week, a month — and never past
   * today (MON-13: this was the one Analytics tab without them).
   */
  const step = (dir: -1 | 1) => {
    if (!date) return;
    const d = parseIso(date);
    if (granularity === "daily") d.setDate(d.getDate() + dir);
    else if (granularity === "weekly") d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    const next = isoOf(d);
    setDate(next > today ? today : next);
  };
  const weekStart = weekStartOf(workdays);
  const periodHoldsToday =
    granularity === "daily"
      ? anchor >= today
      : granularity === "weekly"
        ? weekStartIso(anchor, weekStart) >= weekStartIso(today, weekStart)
        : anchor.slice(0, 7) >= today.slice(0, 7);

  // Hour-by-hour comes from the day's captures (see the hook) — only fetched on the Daily tab,
  // which is the only place an hourly curve is shown.
  const hourly = useHourlyActivity(granularity === "daily" ? date : "");

  /** `0` → "12am", `13` → "1pm". */
  const hourLabel = (h: number) =>
    h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;

  const hourlyData = useMemo(
    () => hourly.hours.map((b) => ({ ...b, label: hourLabel(b.hour) })),
    [hourly.hours],
  );

  /**
   * Only the verdicts that actually occur today.
   *
   * **A stacked `Area` with no data still paints its stroke** — Recharts draws it along the top of
   * its (zero-height) band, which is the top of the whole stack. So a day with nothing flagged
   * still got a full-width line in the flag colour tracing the total, which reads as "flagged" to
   * anyone glancing at it. It was the total.
   */
  const activeCategories = useMemo(
    () => HOUR_VERDICTS.filter((c) => hourly.hours.some((b) => b[c.key] > 0)),
    [hourly.hours],
  );

  // Weekly / Monthly build the trend by fanning per-day org rollups; Daily draws its curve from
  // the day's captures instead (`useHourlyActivity`), so it needs no range.
  //
  // **Never past today.** The range ran to the end of the period, so the current week fetched days
  // that had not happened, and the AI summary's ranking floor (hours × days in the range) asked for
  // a month's worth of tracked time on the 1st (QA audit 2026-10-08, WP-487).
  const rangeDates = useMemo<string[]>(() => {
    if (!date) return [];
    const all =
      granularity === "weekly"
        ? weekWorkdays(anchor, workdays)
        : granularity === "monthly"
          ? monthWorkdays(anchor, workdays)
          : [];
    return all.filter((d) => d <= today);
  }, [granularity, date, anchor, workdays, today]);

  const range = useOrgActivityRange(rangeDates);

  // The period the usage panels cover: the single day for Daily, else the span of the workdays the
  // trend is already built from — so the panels and the chart above them describe the same window.
  const usageRange = useMemo(() => {
    if (!date) return null;
    if (granularity === "daily") return { from: date, to: date };
    if (rangeDates.length === 0) return null;
    const sorted = [...rangeDates].sort();
    return { from: sorted[0], to: sorted[sorted.length - 1] };
  }, [granularity, date, rangeDates]);

  const usage = useAppUsage(usageRange);

  // Trend points: one per workday (weekly) or one per week-average (monthly).
  const trendData = useMemo(() => {
    if (granularity === "weekly") {
      return range.points.map((p) => ({
        label: WEEKDAY[parseIso(p.date).getDay()],
        active: p.score === null ? null : Math.round(p.score),
      }));
    }
    if (granularity === "monthly") {
      // Group workdays into the org's weeks and average the scored days.
      const start = weekStartOf(workdays);
      const buckets: { key: string; scores: number[] }[] = [];
      const index: Record<string, number> = {};
      for (const p of range.points) {
        const key = weekStartIso(p.date, start);
        if (index[key] === undefined) {
          index[key] = buckets.length;
          buckets.push({ key, scores: [] });
        }
        if (p.score !== null) buckets[index[key]].scores.push(p.score);
      }
      return buckets.map((b, i) => ({
        label: `W${i + 1}`,
        active:
          b.scores.length > 0
            ? Math.round(b.scores.reduce((a, s) => a + s, 0) / b.scores.length)
            : null,
      }));
    }
    return [];
  }, [granularity, range.points, workdays]);

  const hasTrend = trendData.some((d) => d.active !== null);

  /** One sentence per chart, for the table toggle's description (MON-16). */
  const hourlySummary = useMemo(() => {
    const busiest = hourlyData.reduce<(typeof hourlyData)[number] | null>(
      (best, b) => (b.total > (best?.total ?? 0) ? b : best),
      null,
    );
    if (!busiest) return undefined;
    const flagged = hourlyData.reduce((s, b) => s + b.flagged, 0);
    return `${countOf(hourly.captures, "capture")}. Busiest hour ${busiest.label}, with ${busiest.total}. ${flagged} flagged by the AI.`;
  }, [hourlyData, hourly.captures]);
  const trendSummary = useMemo(() => {
    const scored = trendData.filter((d) => d.active !== null) as { label: string; active: number }[];
    if (scored.length === 0) return undefined;
    const hi = scored.reduce((a, b) => (b.active > a.active ? b : a));
    const lo = scored.reduce((a, b) => (b.active < a.active ? b : a));
    return `${scored.length} of ${trendData.length} scored. Highest ${hi.label} at ${hi.active}, lowest ${lo.label} at ${lo.active}.`;
  }, [trendData]);

  /**
   * Whether the selected period's figures are still on their way, or failed outright.
   *
   * A failure used to fall straight into the empty states below — "No activity to categorise" and a
   * "0% reporting" ring for an org whose read had 403'd or 500'd (QA audit 2026-10-08, WP-274). For
   * Weekly/Monthly a day whose read failed has `rollup: null`; only *every* day failing is an error,
   * since the rest of the period can still be shown.
   */
  const orgForDay = org.data && org.data.date === date ? org.data : null;
  const rangeFailedDays = range.loading ? 0 : range.points.filter((p) => !p.rollup).length;
  const periodLoading =
    granularity === "daily" ? org.loading && !orgForDay : range.loading && range.points.length === 0;
  const periodError =
    granularity === "daily"
      ? orgForDay
        ? null
        : org.error
      : range.points.length > 0 && rangeFailedDays === range.points.length
        ? "Couldn't load the team's activity for this period. Check your connection and try again."
        : null;
  const retryPeriod = granularity === "daily" ? org.reload : range.reload;

  /**
   * Every figure on this tab, resolved for the **selected period** — one source, so the cards
   * cannot disagree with each other or with the narrative.
   *
   * This used to read the single-day rollup unconditionally, with no dependency on `granularity`.
   * Weekly and Monthly therefore showed one day's numbers: identical "People scored" and "Team avg
   * score" on all three tabs, sitting next to a narrative correctly saying no weekly/monthly report
   * had been generated. The numbers were real, but they were answering a different question than
   * the one the toggle asked.
   *
   * `null` means **there is nothing scored in this period** — every consumer then renders its empty
   * state rather than a zero, because "0" is a measurement and this is an absence of one.
   */
  const stats = useMemo(() => {
    const build = (
      r: {
        total_people: number;
        scored_people: number;
        active_sec_total: number;
        productive_sec_total: number;
        neutral_sec_total: number;
        distracting_sec_total: number;
      },
      // Nullable: a period where nobody cleared the server's 30-minute volume floor has no
      // meaningful mean, but it still has a roster. Collapsing the whole object for want of an
      // average is what made "Not reporting" read 0 while seven agents sat there not reporting.
      avgScore: number | null,
      coverage: { label: string; value: string },
    ) => {
      const catTotal =
        r.productive_sec_total + r.neutral_sec_total + r.distracting_sec_total;
      return {
        coverage,
        avgScore: avgScore === null ? null : Math.round(avgScore),
        activeSec: r.active_sec_total,
        productiveSec: r.productive_sec_total,
        neutralSec: r.neutral_sec_total,
        distractingSec: r.distracting_sec_total,
        catTotal,
        prodPct: catTotal > 0 ? Math.round((r.productive_sec_total / catTotal) * 100) : 0,
        scored: r.scored_people,
        inactive: Math.max(0, r.total_people - r.scored_people),
      };
    };

    if (granularity === "daily") {
      const r = orgForDay?.rollup;
      // `avg_score` is null whenever `scored_people` is 0 — the server withholds a mean it cannot
      // compute. That says nothing about `total_people`, which is still a real roster, so bailing
      // here reported "0 reported, 0 not reporting" for an org with seven enrolled agents: a
      // denominator of zero, presented as a coverage measurement.
      if (!r) return null;
      return build(r, r.avg_score, {
        label: "People scored",
        value: `${r.scored_people}/${r.total_people}`,
      });
    }

    // Weekly / monthly: aggregate the same per-day rollups that already feed the trend chart.
    // Every day that HAS a rollup, scored or not — a day with agents reporting under the floor
    // is a day with coverage to report. `scoredDays` below keeps the average honest.
    const days = range.points.filter((p) => p.rollup);
    if (days.length === 0) return null;

    const sum = days.reduce(
      (a, p) => {
        const r = p.rollup!;
        a.active_sec_total += r.active_sec_total;
        a.productive_sec_total += r.productive_sec_total;
        a.neutral_sec_total += r.neutral_sec_total;
        a.distracting_sec_total += r.distracting_sec_total;
        // Per-day counts cannot be de-duplicated into distinct people over a period, so the
        // headcount figures are the period's **peak day** — a number the data actually supports.
        a.scored_people = Math.max(a.scored_people, r.scored_people);
        a.total_people = Math.max(a.total_people, r.total_people);
        return a;
      },
      {
        total_people: 0,
        scored_people: 0,
        active_sec_total: 0,
        productive_sec_total: 0,
        neutral_sec_total: 0,
        distracting_sec_total: 0,
      },
    );
    // Mean of the scored days — the same mean-of-means the trend chart plots, so the tile and the
    // chart above it can never tell different stories.
    // Averaged over the days that actually produced a score, never over the days that merely
    // had a rollup — dividing by the wider set would drag the mean toward zero with days the
    // server deliberately declined to score.
    const scoredDays = days.filter((p) => p.score !== null);
    const avg =
      scoredDays.length === 0
        ? null
        : scoredDays.reduce((s, p) => s + (p.score ?? 0), 0) / scoredDays.length;
    return build(sum, avg, {
      // "Days scored", not "People scored": we have per-day counts, not identities.
      label: "Days scored",
      value: `${scoredDays.length}/${range.points.length}`,
    });
  }, [granularity, orgForDay, range.points]);

  const scored = stats?.scored ?? 0;
  const inactive = stats?.inactive ?? 0;
  const catTotal = stats?.catTotal ?? 0;

  // Metrics: the real rollup for the selected period (available regardless of the AI add-on).
  // Empty when nothing was scored in that period — the tiles must never assert a figure the
  // narrative beside them is simultaneously calling non-existent.
  const metrics = useMemo(() => {
    if (!stats) return [];
    return [
      { label: stats.coverage.label, value: stats.coverage.value },
      stats.avgScore === null
        ? {
            label: "Team avg score",
            value: "—",
            // Distinct from "no data": days were reported, they were just too thin to score.
            hint: "too little activity",
          }
        : { label: "Team avg score", value: `${stats.avgScore}`, hint: "/ 100" },
      // "Active **time**" — this is `active_sec` (hours with input detected, the opposite of idle).
      // Bare "Active" sat next to people-counts and read as a headcount.
      { label: "Active time", value: fmtHours(stats.activeSec) },
      // `0%` here meant "no app-level categorisation was reported", not "none of the time was
      // productive". Category seconds come only from the agent's `top_apps` spans, which are
      // optional and classified on-device (`wp-agent-contract`: `#[serde(default)] top_apps`), so
      // an agent reporting `active_sec` without them leaves productive/neutral/distracting all
      // zero. Dividing by that produced a confident 0% — a verdict on the team drawn from a gap in
      // instrumentation. Absent stays absent.
      stats.catTotal > 0
        ? { label: "Productive time", value: `${stats.prodPct}%` }
        : {
            label: "Productive time",
            value: "—",
            hint: "no app data",
          },
    ];
  }, [stats]);

  // Publish the day and the hero row to the assistant. `metrics` is already `{label, value}` — the
  // same shape the panel sends — so the figures the user is reading are exactly the ones the model
  // is told about, rather than a second, drifting description of them.
  useAssistantPageContext({
    date: date || null,
    facts: [
      { label: "Tab", value: "Activity" },
      { label: "Granularity", value: granularity },
      ...metrics.map((m) => ({ label: m.label, value: String(m.value) })),
    ],
  });

  return (
    <div className="space-y-4">
      {/* Range filter: granularity + anchor date. Shared with every other period surface — see
          `PeriodFilter`; the pills and the date were duplicated per page before. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PeriodFilter
          granularity={granularity}
          onGranularityChange={setGranularity}
          date={date}
          onDateChange={setDate}
          max={today}
          onStep={step}
          canStepForward={!periodHoldsToday}
        />
        {/* Refetch every panel on this tab in place — no page reload. Placed in the top-navbar
            action slot (via PageActions) so Refresh sits in the same spot as every other page. */}
        <PageActions>
          <RefreshButton
            onRefresh={() => {
              org.reload();
              hourly.reload();
              range.reload();
              usage.reload();
            }}
            refreshing={org.loading || hourly.loading || range.loading || usage.loading}
          />
        </PageActions>
      </div>

      {/* **One** AI summary, not two. This banner used to be an org-wide narrative with a second,
          near-identical department card underneath it — two models describing the same period on
          the same screen. `DepartmentScoreFocus` now renders the banner itself, defaulting to "all"
          (the org-wide reading the old one gave) with a filter for per-department detail. */}
      {usageRange ? (
        <DepartmentScoreFocus
          from={usageRange.from}
          to={usageRange.to}
          dept={dept}
          onDeptChange={setDept}
          // A phrase that stays true whenever it is read. "today" was sent for *any* picked day,
          // and the narrative is cached per range for everyone, so 1 Oct viewed on 8 Oct was
          // briefed — and stored — as "today" (QA audit 2026-10-08, WP-487). A single day needs no
          // phrase: the server names the date itself.
          period={
            granularity === "weekly"
              ? "the week"
              : granularity === "monthly"
                ? "the month"
                : undefined
          }
        />
      ) : null}

      <Card data-tour="insights:trend">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            {CHART_TITLE[granularity]}
            <ChartLegendInfo
              label="What this chart measures"
              terms={
                granularity === "daily"
                  ? [
                      {
                        term: "Captures",
                        definition:
                          "How many screenshots the agent took in that hour, split by the AI's check of each one — the same verdict the Screenshots tab shows: fine for the person's role, flagged as not work for it, or not checked yet. App names play no part.",
                      },
                    ]
                  : [
                      {
                        term: "Productivity score",
                        // Worded from the scorer itself (`score_compute/score.rs`). This used to
                        // describe Focus as task-switching — it is input-gated time — and quote the
                        // weights as fixed, though an org or department can change them
                        // (QA audit 2026-10-08, WP-486).
                        definition: (
                          <>
                            A 0–100 score for the day, blended from four parts (default weights):
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              <li>
                                <strong>Utilization (25%)</strong> — how much of the time on the
                                timer was active at the computer
                              </li>
                              <li>
                                <strong>Quality (40%)</strong> — how productive the active time
                                was: the AI&rsquo;s rating of the day&rsquo;s screenshots, or your
                                app rules when none were rated
                              </li>
                              <li>
                                <strong>Focus (15%)</strong> — how much of the active time had real
                                keyboard or mouse input
                              </li>
                              <li>
                                <strong>Reliability (20%)</strong> — starting on time and working
                                the expected hours
                              </li>
                            </ul>
                            <span className="mt-1 block opacity-80">
                              Your organization can change the weights, org-wide or per department,
                              in Settings → Organization. A day with no agent data isn&rsquo;t
                              scored at all — the line breaks there instead of dropping to 0.
                            </span>
                          </>
                        ),
                      },
                    ]
              }
            />
          </CardTitle>
          <CardDescription>{CHART_SUBTITLE[granularity]}</CardDescription>
        </CardHeader>
        <CardContent>
          {granularity === "daily" ? (
            hourly.loading ? (
              <div className="flex h-[260px] items-center justify-center">
                <Loader label="Reading the day's captures…" />
              </div>
            ) : hourly.error ? (
              <EmptyState
                icon={AlertTriangle}
                title={
                  hourly.denied
                    ? "Hour-by-hour activity isn't available"
                    : "Couldn't load hour-by-hour activity"
                }
                description={hourly.error}
                className="border-0"
                action={
                  hourly.denied ? undefined : (
                    <Button variant="outline" size="sm" onClick={hourly.reload}>
                      Try again
                    </Button>
                  )
                }
              />
            ) : hourly.captures === 0 ? (
              // Says why there were no captures, with the fix (UX audit MON-10).
              <CaptureEmptyState
                date={date}
                today={today}
                icon={Activity}
                title="No hour-by-hour data yet"
                lead="Hour-by-hour activity is drawn from the day's screenshot captures."
                className="border-0"
              />
            ) : (
              <>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {/* `accessibilityLayer`: focusable, and the arrow keys move the tooltip — the
                        values were hover-only (MON-16). The table below is the text alternative. */}
                    <AreaChart
                      data={hourlyData}
                      margin={CHART_MARGIN_WITH_LEGEND}
                      accessibilityLayer
                      title="Captures per hour, by the AI's check of each screenshot"
                    >
                      <defs>
                        {activeCategories.map((c) => (
                          <linearGradient
                            key={c.key}
                            id={`fillHour-${c.key}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor={c.color} stopOpacity={0.45} />
                            <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="label"
                        interval={1}
                        {...xAxisLabel("Hour of day (your local time)")}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      {/* Counts, not a percentage — this axis must scale to the data, unlike the
                          0–100 score axis the weekly/monthly trend uses. Labelled, because a bare
                          "6" on a monitoring chart reads as hours or percent just as easily. */}
                      <YAxis
                        allowDecimals={false}
                        label={{
                          value: "captures",
                          angle: -90,
                          position: "insideLeft",
                          style: { fontSize: 11, fill: "var(--muted-foreground)" },
                        }}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          fontSize: 12,
                          color: "var(--popover-foreground)",
                        }}
                      />
                      {/* Three stacked bands with no key was unreadable: the top line is the
                          running total, not the category whose colour drew it. */}
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="plainline"
                        wrapperStyle={{ fontSize: 12 }}
                        // Labels in text ink, the line beside them in the series colour — a light
                        // grey "Not checked" label was too faint to read.
                        formatter={(value: string) => (
                          <span style={{ color: "var(--muted-foreground)" }}>{value}</span>
                        )}
                      />
                      {activeCategories.map((c) => (
                        <Area
                          key={c.key}
                          type="monotone"
                          dataKey={c.key}
                          stackId="hourly"
                          stroke={c.color}
                          strokeDasharray={c.dash}
                          fill={`url(#fillHour-${c.key})`}
                          strokeWidth={2}
                          name={c.label}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Say what the curve measures. These are capture *moments*, not minutes — the
                    agent samples periodically, so this shows when work happened, not how much.

                    And say what a capped read covers. The day's index is sorted person-then-time,
                    so the cap drops whole people, not the oldest frames: it used to claim "the
                    most recent captures only" over a curve of two or three people's whole day,
                    captioned as the team's (QA audit 2026-10-08, WP-275). */}
                <ChartTable
                  caption="Captures per hour, by the AI's check of each screenshot"
                  summary={hourlySummary}
                  columns={["Hour", ...HOUR_VERDICTS.map((c) => c.label), "Total"]}
                  rows={hourlyData
                    .filter((b) => b.total > 0)
                    .map((b) => [b.label, ...HOUR_VERDICTS.map((c) => b[c.key]), b.total])}
                />
                <p className="text-muted-foreground mt-2 text-xs">
                  {hourly.truncated ? (
                    <>
                      This day has more captures than this chart can read, so it shows{" "}
                      {hourly.people} {hourly.people === 1 ? "person's" : "people's"} hours (
                      {hourly.captures.toLocaleString()} capture
                      {hourly.captures === 1 ? "" : "s"}), not the whole team&rsquo;s — by the
                      hour they were taken: when work happened, not hours worked.
                    </>
                  ) : (
                    <>
                      {hourly.captures.toLocaleString()} screenshot capture
                      {hourly.captures === 1 ? "" : "s"} across the team, by the hour they were
                      taken — when work happened, not hours worked. The AI can be wrong; open a
                      flagged capture on the Screenshots tab to confirm or dismiss it.
                    </>
                  )}
                </p>
              </>
            )
          ) : range.loading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Loader label="Aggregating the team's scores…" />
            </div>
          ) : periodError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load this period"
              description={periodError}
              className="border-0"
              action={
                <Button variant="outline" size="sm" onClick={range.reload}>
                  Try again
                </Button>
              }
            />
          ) : !hasTrend ? (
            <EmptyState
              icon={Activity}
              title="No scores for this period"
              description="The team's productivity scores appear here once the desktop agent reports activity across these days."
              className="border-0"
            />
          ) : (
            <>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={CHART_MARGIN}
                  accessibilityLayer
                  title={CHART_TITLE[granularity]}
                >
                  <defs>
                    <linearGradient id="fillActiveHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    {...xAxisLabel(granularity === "weekly" ? "Day of week" : "Week of month")}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    {...yAxisLabel("Productivity score (0–100)")}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v} / 100`, "Productivity score"]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  {/* No `connectNulls`: an unscored day is a gap, as the legend says, not a line
                      drawn straight across it. Dots, so a lone scored day — an area needs two
                      points — still shows (QA audit 2026-10-08, WP-486). */}
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="var(--chart-1)"
                    fill="url(#fillActiveHr)"
                    strokeWidth={2}
                    name="Productivity score"
                    dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <ChartTable
              caption={CHART_TITLE[granularity]}
              summary={trendSummary}
              columns={[granularity === "weekly" ? "Day" : "Week", "Productivity score (0–100)"]}
              rows={trendData.map((d) => [d.label, d.active === null ? "not scored" : d.active])}
            />
            </>
          )}
          {granularity !== "daily" && !periodError && rangeFailedDays > 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {rangeFailedDays} of {range.points.length}{" "}
              {range.points.length === 1 ? "day" : "days"} couldn&rsquo;t be loaded, so the
              figures on this tab cover the rest of the period.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Two balanced summary cards of similar height */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-tour="insights:categories">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Time by app category
              <ChartLegendInfo
                label="How time is categorized"
                terms={[
                  {
                    term: "Productive / Neutral / Distracting",
                    definition:
                      "Your organization's own app rules decide which is which, from the app's name — the same app can be classified differently by another organization. This is not the AI's judgment: the AI reviews screenshots against each person's role and ignores app names. Website rules aren't applied yet, so time in a browser follows the browser's own rule. Unrecognized apps land in the rules editor's worklist rather than being guessed at.",
                  },
                ]}
              />
            </CardTitle>
            {/* Three bars with percentages and no statement of the denominator. The percentages are
                of *classified* time, not of the working day — a distinction that changes what the
                numbers mean and cannot be seen from the bars. And whose rule it is: app names, not
                the AI (MON-07). */}
            <CardDescription>
              By your app rules (not AI) · share of classified activity time in the selected period
              · unclassified apps are excluded, not counted as neutral
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {periodLoading ? (
              <div className="flex min-h-[8rem] flex-1 items-center justify-center">
                <Loader label="Reading the period's activity…" />
              </div>
            ) : periodError ? (
              <PeriodErrorState message={periodError} onRetry={retryPeriod} />
            ) : catTotal > 0 ? (
              <>
                {CATEGORIES.map((cat) => {
                  const value =
                    cat.key === "productive"
                      ? stats!.productiveSec
                      : cat.key === "neutral"
                        ? stats!.neutralSec
                        : stats!.distractingSec;
                  const pct = Math.round((value / catTotal) * 100);
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.label}
                        </span>
                        <span className="font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-muted-foreground mt-auto pt-1 text-xs">
                  Based on {fmtHours(catTotal)} of categorized activity across the team.
                </p>
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity to categorize"
                description={
                  granularity === "daily"
                    ? "Category time appears once agents report productive / neutral / distracting activity for this day."
                    : "No agent reported categorized activity in this period. Pick a period with scored days, or check that the desktop agents are syncing."
                }
                className="border-0"
              />
            )}
          </CardContent>
        </Card>
        {periodLoading || periodError ? (
          // The ring draws `0%` for an empty roster, which is a coverage *measurement*. Without the
          // period's data there is nothing to measure, so it is not drawn at all.
          <Card>
            <CardHeader>
              <CardTitle>Reporting coverage</CardTitle>
              <CardDescription>
                Share of employees whose desktop agent sent activity in this period
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {periodError ? (
                <PeriodErrorState message={periodError} onRetry={retryPeriod} />
              ) : (
                <div className="flex min-h-[8rem] flex-1 items-center justify-center">
                  <Loader label="Reading the period's activity…" />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <ActiveInactiveRing
            active={scored}
            inactive={inactive}
            // Not employment status: this is who produced agent data. "Inactive" read as
            // "deactivated employee" — it means the agent reported nothing for them.
            title="Reporting coverage"
            description="Share of employees whose desktop agent sent activity in this period — a coverage measure, not an employment one"
            caption="reporting"
            activeLabel="Reported"
            inactiveLabel="Not reporting"
            layout="row"
            // Per-day counts can't be de-duplicated into distinct people across a period, so a
            // multi-day figure is the best single day — say so rather than let it read as "this
            // many people were active all week".
            note={
              granularity === "daily"
                ? undefined
                : "Peak day in this period — per-day counts can't be combined into distinct people."
            }
          />
        )}
      </div>

      <div className="space-y-4">
        {/* A disclosure, said as one: `aria-expanded` + `aria-controls` (MON-16). */}
        <button
          type="button"
          onClick={() => setShowUsage((v) => !v)}
          aria-expanded={showUsage}
          aria-controls="activity-usage-breakdown"
          className="text-muted-foreground hover:text-foreground flex min-h-6 items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", showUsage && "rotate-180")}
            aria-hidden="true"
          />
          {showUsage ? "Hide" : "Show"} app &amp; website breakdown
        </button>
        {showUsage ? (
          <p className="text-xs text-muted-foreground">
            Shading shows each app&apos;s category by your app rules (not AI):{" "}
            {CATEGORIES.map((c, i) => (
              <span key={c.key}>
                {i > 0 ? " · " : ""}
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.label}
                </span>
              </span>
            ))}
          </p>
        ) : null}
        {showUsage ? (
          <div id="activity-usage-breakdown" className="grid gap-4 lg:grid-cols-2">
            <UsageList
              title="Top applications"
              description={`Time spent per application across the team${usageRange ? `, ${usageRange.from === usageRange.to ? `on ${usageRange.from}` : `${usageRange.from} to ${usageRange.to}`}` : ""}`}
              items={usage.apps}
              loading={usage.loading}
              error={usage.error}
              onRetry={usage.denied ? undefined : usage.reload}
              truncated={usage.truncated}
            />
            <UsageList
              title="Top websites"
              description={`Time spent per website across the team${usageRange ? `, ${usageRange.from === usageRange.to ? `on ${usageRange.from}` : `${usageRange.from} to ${usageRange.to}`}` : ""}`}
              items={usage.sites}
              loading={usage.loading}
              error={usage.error}
              onRetry={usage.denied ? undefined : usage.reload}
              // Sites are the one half that can be legitimately empty while apps are not: the
              // agent only reports a URL for browser spans, and `AppSpan.url` is optional.
              emptyHint="Websites appear here once an agent reports browser activity with a URL. App time is still counted above."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The org's app/website usage for a date range.
 *
 * Both panels this feeds were previously `items={[]}` — hardcoded empty behind an empty state that
 * blamed the desktop agent. The agent had been reporting `top_apps` (and browser `url`s) all along;
 * the activity fold summed them into three category buckets and threw the names away, so the server
 * had nothing per-app to serve. It does now.
 */
function useAppUsage(range: { from: string; to: string } | null) {
  const [state, setState] = useState<{
    apps: UsageItem[];
    sites: UsageItem[];
    loading: boolean;
    truncated: boolean;
    error: string | null;
    /** The read was refused (403) — a retry would only be refused again. */
    denied: boolean;
  }>({ apps: [], sites: [], loading: false, truncated: false, error: null, denied: false });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!range) {
      setState({
        apps: [],
        sites: [],
        loading: false,
        truncated: false,
        error: null,
        denied: false,
      });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null, denied: false }));
    // Seconds, as the server counts them. They used to be rounded to whole minutes first, so an
    // early-morning list (every app under 30 s) ranked on zeros, read "00:00:00", and divided by a
    // zero maximum into a `NaN%` bar (QA audit 2026-10-08, WP-485).
    const toItems = (rows: UsageRow[]): UsageItem[] =>
      rows.map((r) => ({ name: r.name, category: r.category, seconds: r.seconds }));
    getAppUsage(range.from, range.to)
      .then((res) => {
        if (!alive) return;
        setState({
          apps: toItems(res.apps),
          sites: toItems(res.sites),
          loading: false,
          truncated: res.truncated,
          error: null,
          denied: false,
        });
      })
      .catch((e) => {
        // A refused or failed read must not blank the rest of the page — but it is not "nothing was
        // reported" either, which is what the panels used to say (QA audit 2026-10-08, WP-274).
        if (!alive) return;
        const denied = e instanceof ApiError && e.status === 403;
        setState({
          apps: [],
          sites: [],
          loading: false,
          truncated: false,
          error: denied
            ? "App and website usage isn't available to you — your organization's plan or settings, or your role, don't include it."
            : e instanceof ApiError
              ? e.message
              : "Couldn't load app usage. Check your connection and try again.",
          denied,
        });
      });
    return () => {
      alive = false;
    };
  }, [range?.from, range?.to, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload };
}

interface UsageItem {
  name: string;
  category: "productive" | "neutral" | "distracting";
  seconds: number;
}

/** The app-rule ramp (see {@link APP_RULE_COLOR}) — no red for an app name (MON-07). */
const CATEGORY_COLOR: Record<UsageItem["category"], string> = APP_RULE_COLOR;

function UsageList({
  title,
  description,
  items,
  loading = false,
  error = null,
  onRetry,
  truncated = false,
  emptyHint,
}: {
  title: string;
  /** What is being ranked and over what period — a bare "Top applications" says neither. */
  description: string;
  items: UsageItem[];
  loading?: boolean;
  /** The read failed — shown instead of the empty state, which would claim nothing was reported. */
  error?: string | null;
  /** Omit for a refusal, which a retry would only repeat. */
  onRetry?: () => void;
  /** The server capped the read, so this is the top of a longer list — say so, never imply totality. */
  truncated?: boolean;
  /** Overrides the empty-state wording where "no data" has a more specific cause than "no agent". */
  emptyHint?: string;
}) {
  // Floored at one second, so a list of all-zero rows draws empty bars rather than `NaN%` ones.
  const max = Math.max(1, ...items.map((i) => i.seconds));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {truncated && items.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Top {items.length} of a longer list — the period exceeded the read limit.
          </p>
        ) : null}
        {loading && items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
        ) : error ? (
          <PeriodErrorState message={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing reported for this period"
            // The old copy said the server "stores daily category totals only", which stopped being
            // true when the fold started recording per-app seconds — and it blamed the agent for a
            // panel that was hardcoded empty and would have stayed empty however much it reported.
            description={
              emptyHint ??
              "No app activity was reported in the selected period. Usage appears here once a desktop agent reports for these days."
            }
            className="border-0"
          />
        ) : (
          items.map((it) => (
            <div key={it.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[it.category] }}
                  />
                  <span className="truncate">{it.name}</span>
                  {/* The category as words too — colour alone can't carry it. */}
                  <span className="shrink-0 text-xs text-muted-foreground">{it.category}</span>
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {formatDuration(it.seconds)}
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(it.seconds / max) * 100}%`,
                    backgroundColor: CATEGORY_COLOR[it.category],
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** A read that failed, said plainly in place of the panel's content — never as an empty period. */
function PeriodErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load this"
      description={message}
      className="border-0"
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
