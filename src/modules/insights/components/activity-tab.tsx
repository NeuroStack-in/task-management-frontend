"use client";

import { useMemo, useState } from "react";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AiInsight } from "@/components/shared/ai-insight";
import { useAssistantStore } from "@/stores/assistant.store";
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
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [date, setDate] = useState("");

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

  const avgKeyboard = avg(series.keyboard);
  const avgMouse = avg(series.mouse);

  const totals = usageTotals(APP_USAGE);
  const totalMin = totals.productive + totals.neutral + totals.distracting;
  const productivePct = Math.round((totals.productive / (totalMin || 1)) * 100);
  const distractingPct = Math.round(
    (totals.distracting / (totalMin || 1)) * 100,
  );

  return (
    <div className="space-y-4">
      {/* Range filter: granularity + specific date */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGranularity(g.key)}
              className={cn(
                "rounded-sm px-3.5 py-1 text-sm font-medium transition-colors",
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

      <AiInsight
        title={`Active time tracking ${productivePct}% productive, ${distractingPct}% distracting`}
        detail="Keyboard and mouse intensity move in step with active share — no idle anomalies in this window."
        points={[
          `${active} people active now · activity averaging ${avg(series.active)}%`,
          `Distracting apps: ${formatMinutes(totals.distracting)} of ${Math.round(totalMin / 60)}h tracked`,
        ]}
        basis={`${Math.round(totalMin / 60)}h of tracked application time today`}
        action={{ label: "Ask the assistant", onClick: () => openAssistant() }}
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
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                />
                <Area type="monotone" dataKey="active" stroke="var(--chart-1)" fill="url(#fillActiveHr)" strokeWidth={2} name="Active %" />
                <Area type="monotone" dataKey="keyboard" stroke="var(--chart-3)" fill="none" strokeWidth={1.5} name="Keyboard" />
                <Area type="monotone" dataKey="mouse" stroke="var(--chart-4)" fill="none" strokeWidth={1.5} name="Mouse" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two balanced summary cards: category split + input-intensity (distinct
          from the Dashboard's active/inactive headcount ring). */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Time by category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(totals) as UsageCategory[]).map((cat) => {
              const pct = Math.round((totals[cat] / (totalMin || 1)) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <span className="font-medium tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full rounded-sm" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLOR[cat] }} />
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              Based on {Math.round(totalMin / 60)}h of tracked application time today.
            </p>
          </CardContent>
        </Card>

        <InputIntensity keyboard={avgKeyboard} mouse={avgMouse} />
      </div>

      {/* App & website breakdown — surfaced by default (no longer buried). */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UsageList title="Top applications" items={APP_USAGE} />
        <UsageList title="Top websites" items={URL_USAGE} />
      </div>
    </div>
  );
}

/**
 * Keyboard vs mouse input intensity — a distinct cut from the Dashboard's
 * active/inactive headcount donut. Shows how the two input streams compare, the
 * signal that drives "active" detection.
 */
function InputIntensity({
  keyboard,
  mouse,
}: {
  keyboard: number;
  mouse: number;
}) {
  const rows = [
    { label: "Keyboard", value: keyboard, color: "var(--chart-3)" },
    { label: "Mouse", value: mouse, color: "var(--chart-4)" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input intensity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ backgroundColor: r.color }} />
                {r.label}
              </span>
              <span className="font-medium tabular-nums">{r.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full rounded-sm"
                style={{ width: `${r.value}%`, backgroundColor: r.color }}
              />
            </div>
          </div>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Average keyboard and mouse activity share — the two signals behind
          active-time detection.
        </p>
      </CardContent>
    </Card>
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
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: CATEGORY_COLOR[it.category] }}
                />
                {it.name}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatMinutes(it.minutes)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full rounded-sm"
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
