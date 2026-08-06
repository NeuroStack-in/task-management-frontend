"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

/**
 * Activity — the preview's Analytics layout (granularity toggle · AI report card · activity area
 * chart · time-by-category · active/inactive ring · app & website breakdown) wired to the real
 * productivity-score read models (LLD §12), element-for-element. Where the server has a real source
 * the element shows it; where it doesn't yet, the element degrades to an honest empty **in place**
 * rather than being removed or fabricated:
 *  • Time by category / AI metrics / active-vs-inactive ring — real (org day rollup).
 *  • AI narrative — real (`GET /v1/insights/reports/ai`), Enterprise-gated → honest upsell note.
 *  • Weekly / Monthly trend — real, aggregated from per-day org rollups (fan-out, concurrency 3).
 *  • Daily trend — no hourly source (the scorer stores daily totals), so the chart body is an honest
 *    "waiting on minute-level capture" note; the card and toggle stay.
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
  weekly: "Activity by day",
  monthly: "Activity by week",
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

/** Mon–Fri ISO dates of the week containing `anchor`. */
function weekWorkdays(anchor: string): string[] {
  const d = parseIso(anchor);
  const dow = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = shiftIso(anchor, mondayOffset);
  return [0, 1, 2, 3, 4].map((i) => shiftIso(monday, i));
}

/** All Mon–Fri ISO dates of the month containing `anchor`. */
function monthWorkdays(anchor: string): string[] {
  const d = parseIso(anchor);
  const year = d.getFullYear();
  const month = d.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) {
    const cur = new Date(year, month, day);
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) out.push(isoOf(cur));
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

  // Weekly / Monthly build the trend by fanning per-day org rollups; Daily has no hourly source.
  const rangeDates = useMemo<string[]>(() => {
    if (!date) return [];
    if (granularity === "weekly") return weekWorkdays(anchor);
    if (granularity === "monthly") return monthWorkdays(anchor);
    return [];
  }, [granularity, date, anchor]);

  const range = useOrgActivityRange(rangeDates);

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

  const rollup = org.data?.rollup;
  const scored = rollup?.scored_people ?? 0;
  const totalPeople = rollup?.total_people ?? 0;
  const inactive = Math.max(0, totalPeople - scored);

  const catTotal = rollup
    ? rollup.productive_sec_total + rollup.neutral_sec_total + rollup.distracting_sec_total
    : 0;
  const prodPct = catTotal > 0 ? Math.round((rollup!.productive_sec_total / catTotal) * 100) : 0;

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

  // Metrics: real org rollup (available regardless of the AI add-on). Empty until someone reports.
  const metrics = useMemo(() => {
    if (!rollup || rollup.avg_score === null) return [];
    return [
      { label: "People scored", value: `${rollup.scored_people}/${rollup.total_people}` },
      { label: "Team avg score", value: `${Math.round(rollup.avg_score)}`, hint: "/ 100" },
      { label: "Active", value: fmtHours(rollup.active_sec_total) },
      { label: "Productive time", value: `${prodPct}%` },
    ];
  }, [rollup, prodPct]);

  return (
    <div className="space-y-4">
      {/* Range filter: granularity + specific date */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        <div className="flex rounded-full border bg-background p-0.5">
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
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
          <CardTitle>{CHART_TITLE[granularity]}</CardTitle>
        </CardHeader>
        <CardContent>
          {granularity === "daily" ? (
            <EmptyState
              icon={Activity}
              title="No hour-by-hour data yet"
              description="Hour-by-hour activity appears once the desktop agent reports minute-level capture — the server stores daily totals only, so there's no hourly curve to draw."
              className="border-0"
            />
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
                <AreaChart data={trendData} margin={{ left: -18, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="fillActiveHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Area type="monotone" dataKey="active" stroke="var(--chart-1)" fill="url(#fillActiveHr)" strokeWidth={2} name="Active %" connectNulls />
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
            <CardTitle>Time by category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {catTotal > 0 ? (
              <>
                {CATEGORIES.map((cat) => {
                  const value =
                    cat.key === "productive"
                      ? rollup!.productive_sec_total
                      : cat.key === "neutral"
                        ? rollup!.neutral_sec_total
                        : rollup!.distracting_sec_total;
                  const pct = Math.round((value / catTotal) * 100);
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.label}
                        </span>
                        <span className="font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  );
                })}
                <p className="mt-auto pt-1 text-xs text-muted-foreground">
                  Based on {fmtHours(catTotal)} of categorised activity across the team.
                </p>
              </>
            ) : (
              <EmptyState
                icon={Activity}
                title="No activity to categorise"
                description="Category time appears once agents report productive / neutral / distracting activity for this day."
                className="border-0"
              />
            )}
          </CardContent>
        </Card>
        <ActiveInactiveRing active={scored} inactive={inactive} layout="row" />
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowUsage((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", showUsage && "rotate-180")}
          />
          {showUsage ? "Hide" : "Show"} app &amp; website breakdown
        </button>
        {showUsage ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <UsageList title="Top applications" items={[]} />
            <UsageList title="Top websites" items={[]} />
          </div>
        ) : null}
      </div>
    </div>
  );
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

function UsageList({ title, items }: { title: string; items: UsageItem[] }) {
  const max = items.length ? Math.max(...items.map((i) => i.minutes)) : 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Waiting on the desktop agent"
            description="App & website capture appears here once the desktop agent reports minute-level activity. The server stores daily category totals only today."
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
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatMinutes(it.minutes)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
