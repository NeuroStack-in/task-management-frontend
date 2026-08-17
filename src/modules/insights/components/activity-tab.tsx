"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Activity, ChevronDown } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
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
import { cn } from "@/lib/utils";
import { AiReportCard } from "./ai-report-card";
import { useOrgActivity } from "../use-activity";
import { useAiReport } from "../use-reports";
import { useOrgActivityRange } from "../use-activity-range";
import { useHourlyActivity } from "../use-hourly-activity";
import { getAppUsage, type UsageRow } from "../services/insights.service";
import {
  CHART_MARGIN,
  CHART_MARGIN_WITH_LEGEND,
  xAxisLabel,
  yAxisLabel,
} from "@/components/shared/chart-axis";
import { useWorkdays } from "@/hooks/use-working-hours";
import { isWorkday, type IsoWeekday } from "@/lib/workdays";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

/**
 * Activity — the preview's Analytics layout (granularity toggle · AI report card · activity area
 * chart · time-by-category · active/inactive ring · app & website breakdown) wired to the real
 * productivity-score read models (LLD §12), element-for-element. Where the server has a real source
 * the element shows it; where it doesn't yet, the element degrades to an honest empty **in place**
 * rather than being removed or fabricated:
 *  • Time by category / AI metrics / active-vs-inactive ring — real, and **scoped to the selected
 *    granularity**: the day's rollup for Daily, an aggregate of the period's per-day rollups for
 *    Weekly/Monthly. They previously always read the single day, so Weekly and Monthly showed a
 *    day's figures beside a narrative correctly reporting no weekly/monthly data existed.
 *  • AI narrative — real (`GET /v1/insights/reports/ai`), Enterprise-gated → honest upsell note.
 *  • Weekly / Monthly trend — real, aggregated from per-day org rollups (fan-out, concurrency 3).
 *  • Daily trend — real, from the day's **screenshot captures** (`captured_at` + the server's
 *    category), bucketed into local hours. The scorer stores daily totals so there is no hourly
 *    *score*; captures are a real record of when work happened, and are labelled as moments rather
 *    than minutes. Empty only when the day genuinely has no captures.
 *  • App & website breakdown — no per-app endpoint, so both lists are an honest "waiting on the
 *    agent" note; the section and toggle stay.
 */

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

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
  daily: "Captures per hour, by category",
  weekly: "Score out of 100 · one point per day",
  monthly: "Score out of 100 · one point per week",
};

const CATEGORIES = [
  { key: "productive", label: "Productive", color: "var(--success)" },
  { key: "neutral", label: "Neutral", color: "var(--chart-2)" },
  { key: "distracting", label: "Distracting", color: "var(--destructive)" },
] as const;

const fmtHours = (sec: number): string => {
  const h = sec / 3600;
  return `${h.toFixed(h >= 10 ? 0 : 1)}h`;
};

const formatMinutes = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// ── date helpers ──────────────────────────────────────────────────────────────
function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The org's **scheduled** ISO dates in the week containing `anchor`. */
function weekWorkdays(anchor: string, workdays: readonly IsoWeekday[]): string[] {
  const d = parseIso(anchor);
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = shiftIso(anchor, mondayOffset);
  // `workdays` is ISO (1 = Mon), so day N sits N-1 days after the week's Monday.
  return [...workdays].sort((a, b) => a - b).map((iso) => shiftIso(monday, iso - 1));
}

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

export function ActivityTab() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [date, setDate] = useState("");
  const [showUsage, setShowUsage] = useState(false);

  // Default to today; set client-side to avoid an SSR/client date mismatch. (Today may read partial
  // until the day accrues data and the overnight close cron scores it — use the picker for a
  // completed prior day.)
  useEffect(() => setDate(isoOf(new Date())), []);
  const today = isoOf(new Date());
  const anchor = date || today;

  const org = useOrgActivity(date);
  // The AI narrative follows BOTH filters: the granularity toggle picks the artifact (org day /
  // ISO-week / month report — separately cached server-side), the date anchors which one.
  const ai = useAiReport(granularity, date);

  const workdays = useWorkdays();

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
   * Only the categories that actually occur today.
   *
   * **A stacked `Area` with no data still paints its stroke** — Recharts draws it along the top of
   * its (zero-height) band, which is the top of the whole stack. So a day with zero distracting
   * captures still got a full-width `--destructive` line tracing the total, and red across the top
   * of a productivity chart reads as "distraction" to anyone glancing at it. It was the total.
   */
  const activeCategories = useMemo(
    () => CATEGORIES.filter((c) => hourly.hours.some((b) => b[c.key] > 0)),
    [hourly.hours],
  );

  // Weekly / Monthly build the trend by fanning per-day org rollups; Daily draws its curve from
  // the day's captures instead (`useHourlyActivity`), so it needs no range.
  const rangeDates = useMemo<string[]>(() => {
    if (!date) return [];
    if (granularity === "weekly") return weekWorkdays(anchor, workdays);
    if (granularity === "monthly") return monthWorkdays(anchor, workdays);
    return [];
  }, [granularity, date, anchor, workdays]);

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
      // Group workdays into weeks (by Monday) and average the scored days.
      const buckets: { key: string; scores: number[] }[] = [];
      const index: Record<string, number> = {};
      for (const p of range.points) {
        const d = parseIso(p.date);
        const dow = d.getDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const key = shiftIso(p.date, mondayOffset);
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
  }, [granularity, range.points]);

  const hasTrend = trendData.some((d) => d.active !== null);

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
      avgScore: number,
      coverage: { label: string; value: string },
    ) => {
      const catTotal =
        r.productive_sec_total + r.neutral_sec_total + r.distracting_sec_total;
      return {
        coverage,
        avgScore: Math.round(avgScore),
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
      const r = org.data?.rollup;
      if (!r || r.avg_score === null) return null;
      return build(r, r.avg_score, {
        label: "People scored",
        value: `${r.scored_people}/${r.total_people}`,
      });
    }

    // Weekly / monthly: aggregate the same per-day rollups that already feed the trend chart.
    const days = range.points.filter((p) => p.rollup && p.score !== null);
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
    const avg = days.reduce((s, p) => s + (p.score ?? 0), 0) / days.length;
    return build(sum, avg, {
      // "Days scored", not "People scored": we have per-day counts, not identities.
      label: "Days scored",
      value: `${days.length}/${range.points.length}`,
    });
  }, [granularity, org.data, range.points]);

  const scored = stats?.scored ?? 0;
  const inactive = stats?.inactive ?? 0;
  const catTotal = stats?.catTotal ?? 0;

  // AI narrative: real, or an honest note when locked / loading / unavailable — never a fabricated paragraph.
  const summary = useMemo(() => {
    if (ai.loading && !ai.data && !ai.locked) return "Generating the AI activity report…";
    if (ai.locked)
      return "The AI activity report is an Enterprise add-on. The team metrics below are live — upgrade to unlock the AI-written narrative for this period.";
    if (ai.error) return ai.error;
    // A period with nothing to reduce returns an empty narrative + the server's reason — show it.
    if (ai.data) return ai.data.narrative || ai.data.reason || "";
    return "The AI activity report appears here once there's scored activity for this period.";
  }, [ai.loading, ai.data, ai.locked, ai.error]);

  // Metrics: the real rollup for the selected period (available regardless of the AI add-on).
  // Empty when nothing was scored in that period — the tiles must never assert a figure the
  // narrative beside them is simultaneously calling non-existent.
  const metrics = useMemo(() => {
    if (!stats) return [];
    return [
      { label: stats.coverage.label, value: stats.coverage.value },
      { label: "Team avg score", value: `${stats.avgScore}`, hint: "/ 100" },
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
      {/* Range filter: granularity + specific date */}
      <div className="bg-card shadow-soft flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
        <div className="bg-background flex rounded-full border p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGranularity(g.key)}
              className={cn(
                "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                granularity === g.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Date
          <DatePicker
            value={date}
            max={today}
            onChange={setDate}
            className="w-[10.5rem]"
          />
        </label>
      </div>

      <AiReportCard
        title="AI activity report"
        summary={summary}
        metrics={metrics}
        // Only when a narrative actually loaded: locked orgs get the upsell, empty periods have
        // nothing to re-run, and each press is a fresh billed generation.
        onRegenerate={ai.data?.narrative ? ai.regenerate : undefined}
        regenerating={ai.regenerating}
      />

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
                          "How many screenshots the agent took in that hour, split by the category your rules give the app that was in front.",
                      },
                    ]
                  : [
                      {
                        term: "Productivity score",
                        definition: (
                          <>
                            A 0–100 score for the day, blended from four parts:
                            <ul className="mt-1 list-disc space-y-0.5 pl-4">
                              <li>
                                <strong>Utilisation (25%)</strong> — how much of the day was active
                              </li>
                              <li>
                                <strong>Quality (40%)</strong> — active time spent in productive apps
                              </li>
                              <li>
                                <strong>Focus (15%)</strong> — steady work vs. constant switching
                              </li>
                              <li>
                                <strong>Reliability (20%)</strong> — showing up consistently
                              </li>
                            </ul>
                            <span className="mt-1 block opacity-80">
                              A day with no agent data isn&rsquo;t scored at all — the line breaks
                              instead of dropping to 0.
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
            ) : hourly.captures === 0 ? (
              <EmptyState
                icon={Activity}
                title="No hour-by-hour data yet"
                description="Hour-by-hour activity is drawn from the day's screenshot captures. None were recorded for this date — it appears here once the desktop agent reports."
                className="border-0"
              />
            ) : (
              <>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData} margin={CHART_MARGIN_WITH_LEGEND}>
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
                      />
                      {activeCategories.map((c) => (
                        <Area
                          key={c.key}
                          type="monotone"
                          dataKey={c.key}
                          stackId="hourly"
                          stroke={c.color}
                          fill={`url(#fillHour-${c.key})`}
                          strokeWidth={2}
                          name={c.label}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {/* Say what the curve measures. These are capture *moments*, not minutes — the
                    agent samples periodically, so this shows when work happened, not how much. */}
                <p className="text-muted-foreground mt-2 text-xs">
                  {hourly.captures.toLocaleString()} screenshot capture
                  {hourly.captures === 1 ? "" : "s"} across the team, by the hour they
                  were taken — when work happened, not hours worked.
                  {hourly.truncated
                    ? " Showing the most recent captures only; the day has more than this view reads."
                    : ""}
                </p>
              </>
            )
          ) : range.loading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Loader label="Aggregating the team's scores…" />
            </div>
          ) : !hasTrend ? (
            <EmptyState
              icon={Activity}
              title="No scores for this period"
              description="The team's productivity scores appear here once the desktop agent reports activity across these days."
              className="border-0"
            />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={CHART_MARGIN}>
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
                  <Area
                    type="monotone"
                    dataKey="active"
                    stroke="var(--chart-1)"
                    fill="url(#fillActiveHr)"
                    strokeWidth={2}
                    name="Productivity score"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two balanced summary cards of similar height */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-tour="insights:categories">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Time by category
              <ChartLegendInfo
                label="How time is categorised"
                terms={[
                  {
                    term: "Productive / Neutral / Distracting",
                    definition:
                      "Your organisation's own app and URL rules decide which is which — the same app can be classified differently by another organisation. Unrecognised apps land in the rules editor's worklist rather than being guessed at.",
                  },
                ]}
              />
            </CardTitle>
            {/* Three bars with percentages and no statement of the denominator. The percentages are
                of *classified* time, not of the working day — a distinction that changes what the
                numbers mean and cannot be seen from the bars. */}
            <CardDescription>
              Share of classified activity time in the selected period · unclassified apps are
              excluded, not counted as neutral
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {catTotal > 0 ? (
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
                  Based on {fmtHours(catTotal)} of categorised activity across the team.
                </p>
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity to categorise"
                description={
                  granularity === "daily"
                    ? "Category time appears once agents report productive / neutral / distracting activity for this day."
                    : "No agent reported categorised activity in this period. Pick a period with scored days, or check that the desktop agents are syncing."
                }
                className="border-0"
              />
            )}
          </CardContent>
        </Card>
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
          // multi-day figure is the best single day — say so rather than let it read as "this many
          // people were active all week".
          note={
            granularity === "daily"
              ? undefined
              : "Peak day in this period — per-day counts can't be combined into distinct people."
          }
        />
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowUsage((v) => !v)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", showUsage && "rotate-180")}
          />
          {showUsage ? "Hide" : "Show"} app &amp; website breakdown
        </button>
        {showUsage ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <UsageList
              title="Top applications"
              description={`Time spent per application across the team${usageRange ? `, ${usageRange.from === usageRange.to ? `on ${usageRange.from}` : `${usageRange.from} to ${usageRange.to}`}` : ""}`}
              items={usage.apps}
              loading={usage.loading}
              truncated={usage.truncated}
            />
            <UsageList
              title="Top websites"
              description={`Time spent per website across the team${usageRange ? `, ${usageRange.from === usageRange.to ? `on ${usageRange.from}` : `${usageRange.from} to ${usageRange.to}`}` : ""}`}
              items={usage.sites}
              loading={usage.loading}
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
  }>({ apps: [], sites: [], loading: false, truncated: false });

  useEffect(() => {
    if (!range) {
      setState({ apps: [], sites: [], loading: false, truncated: false });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const toItems = (rows: UsageRow[]): UsageItem[] =>
      rows.map((r) => ({
        name: r.name,
        category: r.category,
        // The panel renders minutes; the server counts seconds. Rounding here rather than
        // server-side keeps the API in the unit it actually stores.
        minutes: Math.round(r.seconds / 60),
      }));
    getAppUsage(range.from, range.to)
      .then((res) => {
        if (!alive) return;
        setState({
          apps: toItems(res.apps),
          sites: toItems(res.sites),
          loading: false,
          truncated: res.truncated,
        });
      })
      .catch(() => {
        // A refused or failed read must not blank the rest of the page. The panel falls back to its
        // empty state, which is honest: we have nothing to show.
        if (alive) setState({ apps: [], sites: [], loading: false, truncated: false });
      });
    return () => {
      alive = false;
    };
  }, [range?.from, range?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

interface UsageItem {
  name: string;
  category: "productive" | "neutral" | "distracting";
  minutes: number;
}

const CATEGORY_COLOR: Record<UsageItem["category"], string> = {
  productive: "var(--success)",
  neutral: "var(--chart-2)",
  distracting: "var(--destructive)",
};

function UsageList({
  title,
  description,
  items,
  loading = false,
  truncated = false,
  emptyHint,
}: {
  title: string;
  /** What is being ranked and over what period — a bare "Top applications" says neither. */
  description: string;
  items: UsageItem[];
  loading?: boolean;
  /** The server capped the read, so this is the top of a longer list — say so, never imply totality. */
  truncated?: boolean;
  /** Overrides the empty-state wording where "no data" has a more specific cause than "no agent". */
  emptyHint?: string;
}) {
  const max = items.length ? Math.max(...items.map((i) => i.minutes)) : 1;
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
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[it.category] }}
                  />
                  {it.name}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {formatMinutes(it.minutes)}
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(it.minutes / max) * 100}%`,
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
