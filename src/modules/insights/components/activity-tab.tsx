"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActiveInactiveRing } from "@/modules/dashboard/components/insight-widgets";
import { users } from "@/lib/data";
import {
  APP_USAGE,
  URL_USAGE,
  activitySeries,
  usageTotals,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  type Granularity,
  type UsageItem,
  type UsageCategory,
} from "@/lib/mock-insights";
import { cn } from "@/lib/utils";
import { AiReportCard } from "./ai-report-card";

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

const formatMinutes = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

/** Stable numeric seed from a chosen date so the mock curve shifts per date. */
const dateSeed = (date: string): number =>
  [...date].reduce((s, c) => s + c.charCodeAt(0), 0);

export function ActivityTab() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [date, setDate] = useState("");
  const [showUsage, setShowUsage] = useState(false);

  const series = useMemo(
    () => activitySeries(granularity, date ? dateSeed(date) : 0),
    [granularity, date],
  );

  const trendData = useMemo(
    () =>
      series.labels.map((label, i) => ({
        label,
        active: series.active[i],
        keyboard: series.keyboard[i],
        mouse: series.mouse[i],
      })),
    [series],
  );

  const active = users.filter((u) => u.status === "active").length;
  const inactive = users.filter((u) => u.status === "inactive").length;

  // "Active now" is only meaningful live (daily); for a range, show the average.
  const activeLabel = granularity === "daily" ? "Active now" : "Active users";
  const activeHint =
    granularity === "daily"
      ? "live"
      : granularity === "weekly"
        ? "avg this week"
        : "avg this month";

  const totals = usageTotals(APP_USAGE);
  const totalMin = totals.productive + totals.neutral + totals.distracting;
  const productivePct = Math.round((totals.productive / (totalMin || 1)) * 100);

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
            max="2026-06-25"
            onChange={setDate}
            className="w-[10.5rem]"
          />
        </label>
      </div>

      <AiReportCard
        title="AI activity report"
        summary="Active time is tracking above the weekly average, with clear peaks around 11am and 4pm and the usual post-lunch dip. Keyboard and mouse intensity stay in step — no idle anomalies detected today."
        metrics={[
          { label: activeLabel, value: active, hint: activeHint },
          { label: "Avg. active", value: `${avg(series.active)}%`, delta: 4 },
          { label: "Productive time", value: `${productivePct}%`, delta: 2 },
          {
            label: "Distracting time",
            value: formatMinutes(totals.distracting),
            delta: -6,
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{series.title}</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <Area type="monotone" dataKey="active" stroke="var(--chart-1)" fill="url(#fillActiveHr)" strokeWidth={2} name="Active %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      {/* Two balanced summary cards of similar height */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Time by category</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {(Object.keys(totals) as UsageCategory[]).map((cat) => {
              const pct = Math.round((totals[cat] / (totalMin || 1)) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <span className="font-medium tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOR[cat] }} />
                  </div>
                </div>
              );
            })}
            <p className="mt-auto pt-1 text-xs text-muted-foreground">
              Based on {Math.round(totalMin / 60)}h of tracked application time today.
            </p>
          </CardContent>
        </Card>
        <ActiveInactiveRing active={active} inactive={inactive} layout="row" />
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
            <UsageList title="Top applications" items={APP_USAGE} />
            <UsageList title="Top websites" items={URL_USAGE} />
          </div>
        ) : null}
      </div>
    </div>
  );
}


function UsageList({ title, items }: { title: string; items: UsageItem[] }) {
  const max = Math.max(...items.map((i) => i.minutes));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((it) => (
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
        ))}
      </CardContent>
    </Card>
  );
}
