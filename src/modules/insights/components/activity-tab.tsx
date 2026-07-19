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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ActiveInactiveRing } from "@/modules/dashboard/components/insight-widgets";
import { cn } from "@/lib/utils";
import { useOrgActivity, useSelfActivity } from "../use-activity";

/**
 * Activity — the productivity-score read models (LLD §12), wearing the preview's layout: an AI hero
 * card, a trend area chart, a category split, and an active/inactive ring. **Everything is real:**
 *  • Org day rollup (`GET /v1/insights/activity`) drives the AI card metrics, the category split,
 *    and the active/inactive ring (people reporting vs not).
 *  • Personal trend (`GET /v1/me/insights/activity`) drives the area chart — the caller's daily
 *    productivity score over a 14-day window.
 *
 * The preview's seeded curve/deltas and its per-app / per-URL usage lists are dropped: the server has
 * no hourly buckets and no per-app data (that needs minute-level agent capture), so the app/website
 * breakdown degrades to an honest "waiting on the agent" note rather than a fabricated list. Owners
 * and admins with no personal activity see the trend section degrade honestly.
 */

const SELF_WINDOW_DAYS = 14;

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const fmtHours = (sec: number): string => {
  const h = sec / 3600;
  return `${h.toFixed(h >= 10 ? 0 : 1)}h`;
};

const CATEGORIES = [
  { key: "productive", label: "Productive", color: "var(--success)" },
  { key: "neutral", label: "Neutral", color: "var(--warning)" },
  { key: "distracting", label: "Distracting", color: "var(--destructive)" },
] as const;

export function ActivityTab() {
  // Default to yesterday (a completed, fully-scored day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const today = isoOf(new Date());
  const selfFrom = date ? shiftIso(date, -(SELF_WINDOW_DAYS - 1)) : "";

  const org = useOrgActivity(date);
  const self = useSelfActivity(selfFrom, date);

  return (
    <div className="space-y-4">
      {/* Range filter — a single day (the scorer stores daily totals; no weekly/monthly rollup). */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Productivity scores</p>
          <p className="text-xs text-muted-foreground">
            Deterministic U/Q/F/R scoring from reported activity.
          </p>
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

      <OrgAiCard state={org} date={date} />

      <SelfTrendCard state={self} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryCard state={org} />
        <RingCard state={org} />
      </div>

      {/* Honest degradation: the scorer stores daily totals only — no minute-level app/URL buckets. */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowBreakdown((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", showBreakdown && "rotate-180")}
          />
          {showBreakdown ? "Hide" : "Show"} app &amp; website breakdown
        </button>
        {showBreakdown ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={Activity}
                title="Waiting on the desktop agent"
                description="Per-application and per-website usage appears here once the desktop agent reports minute-level capture. The server stores daily category totals only today."
                className="border-0"
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ AI activity card ----------------------------- */

function OrgAiCard({
  state,
  date,
}: {
  state: ReturnType<typeof useOrgActivity>;
  date: string;
}) {
  const { data, loading, error } = state;
  const rollup = data?.rollup;

  const catTotal = rollup
    ? rollup.productive_sec_total + rollup.neutral_sec_total + rollup.distracting_sec_total
    : 0;
  const prodPct = catTotal > 0 ? Math.round((rollup!.productive_sec_total / catTotal) * 100) : 0;

  const summary = useMemo(() => {
    if (loading && !data) return "Scoring the team…";
    if (error) return error;
    if (!rollup || rollup.avg_score === null) {
      return "No one reported activity on this day yet, so there's no team score to summarise. Scores appear once the desktop agent reports.";
    }
    const people = `${rollup.scored_people} of ${rollup.total_people} ${
      rollup.total_people === 1 ? "person" : "people"
    }`;
    return `${people} reported activity${date ? ` on ${shortDate(date)}` : ""}. Team productivity averages ${Math.round(
      rollup.avg_score,
    )}/100, with ${fmtHours(rollup.active_sec_total)} active and ${prodPct}% of categorised time productive.`;
  }, [loading, data, error, rollup, prodPct, date]);

  return (
    <Card className="border-0 bg-feature text-feature-foreground shadow-none">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">Activity report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <p className="max-w-3xl text-sm leading-relaxed text-feature-foreground/90">{summary}</p>
        {rollup && rollup.avg_score !== null ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-3">
            <Metric label="People scored" value={`${rollup.scored_people}/${rollup.total_people}`} />
            <Metric label="Team avg score" value={`${Math.round(rollup.avg_score)}`} hint="/ 100" />
            <Metric label="Active" value={fmtHours(rollup.active_sec_total)} />
            <Metric label="Productive time" value={`${prodPct}%`} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-feature-foreground/70">{hint}</span> : null}
      </div>
      <p className="mt-0.5 text-xs text-feature-foreground/75">{label}</p>
    </div>
  );
}

/* ------------------------------- self trend chart ---------------------------- */

function SelfTrendCard({ state }: { state: ReturnType<typeof useSelfActivity> }) {
  const { data, loading, error } = state;

  const trendData = useMemo(
    () =>
      (data?.days ?? [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({ label: shortDate(d.date), score: Math.round(d.score) })),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your {SELF_WINDOW_DAYS}-day productivity trend</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="flex min-h-[10rem] items-center justify-center">
            <Loader label="Loading your trend…" />
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
        ) : trendData.length < 2 ? (
          <EmptyState
            icon={Activity}
            title="Not enough scored days"
            description="Your daily productivity scores appear here once the desktop agent has reported activity across a few days. Owner and admin accounts that don't track personally won't have a personal trend."
            className="border-0"
          />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="fillScoreTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  domain={[0, 100]}
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
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--chart-1)"
                  fill="url(#fillScoreTrend)"
                  strokeWidth={2}
                  name="Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------- category card ------------------------------ */

function CategoryCard({ state }: { state: ReturnType<typeof useOrgActivity> }) {
  const rollup = state.data?.rollup;
  const values: Record<string, number> = {
    productive: rollup?.productive_sec_total ?? 0,
    neutral: rollup?.neutral_sec_total ?? 0,
    distracting: rollup?.distracting_sec_total ?? 0,
  };
  const total = values.productive + values.neutral + values.distracting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time by category</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {total > 0 ? (
          <>
            {CATEGORIES.map((cat) => {
              const pct = Math.round((values[cat.key] / total) * 100);
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
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="mt-auto pt-1 text-xs text-muted-foreground">
              Based on {fmtHours(total)} of categorised activity across the team.
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
  );
}

/* --------------------------------- ring card --------------------------------- */

function RingCard({ state }: { state: ReturnType<typeof useOrgActivity> }) {
  const rollup = state.data?.rollup;
  const scored = rollup?.scored_people ?? 0;
  const total = rollup?.total_people ?? 0;
  // "Active" = people whose agent reported activity today; the rest are inactive/not reporting.
  return <ActiveInactiveRing active={scored} inactive={Math.max(0, total - scored)} layout="row" />;
}
