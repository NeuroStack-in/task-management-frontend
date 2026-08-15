"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
import { CHART_MARGIN, xAxisLabel, yAxisLabel } from "@/components/shared/chart-axis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScoreTrendPoint } from "@/modules/dashboard/lib/dashboard-data";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

/**
 * The trend widget, restored with actual values — made honest. Two 0–100 series on ONE scale
 * (a score and a percentage; validated palette, indigo vs green): the composite score and the
 * productive share. Both break (`connectNulls={false}`) on days they couldn't be measured, so an
 * unmeasured day is a gap, never the misleading ~50 the old card filled in.
 */
const SERIES = [
  { key: "score", name: "Productivity score", color: "var(--chart-1)", unit: " / 100" },
  { key: "share", name: "Productive share", color: "var(--success)", unit: "%" },
] as const;

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: ScoreTrendPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="bg-popover text-popover-foreground border-border rounded-[var(--radius)] border p-2.5 text-xs shadow-md">
      <div className="text-muted-foreground mb-1.5 font-medium">{row?.label}</div>
      <ul className="space-y-1">
        {SERIES.map((s) => {
          const entry = payload.find((p) => p.name === s.name);
          const v = typeof entry?.value === "number" ? entry.value : null;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <span className="text-muted-foreground flex-1">{s.name}</span>
              <span className="font-medium tabular-nums">
                {v === null ? "not measured" : `${v}${s.unit}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="text-muted-foreground border-border/60 mt-2 border-t pt-1.5">
        {row?.measured ? `${row.measured} scored` : "quality not measured"}
      </div>
    </div>
  );
}

export function ProductivityTrendChart({
  data,
  rangeLabel,
}: {
  data: ScoreTrendPoint[];
  rangeLabel: string;
}) {
  const anyMeasured = data.some((d) => d.score !== null || d.share !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Productivity trends
          <ChartLegendInfo
            label="What Productivity score and Productive share mean"
            terms={[
              {
                term: "Productivity score",
                definition: (
                  <>
                    0–100 composite of utilisation, quality, focus and reliability — plotted{" "}
                    <em>only</em> on days quality was actually measured, so a partial score is never
                    shown as a real one.
                  </>
                ),
              },
              {
                term: "Productive share",
                definition: (
                  <>
                    Of <em>active</em> time (keyboard/mouse input), the percentage in apps your rules
                    classify as productive. Blank on days nothing was classified.
                  </>
                ),
              },
            ]}
          />
        </CardTitle>
        <CardDescription>Score &amp; productive share · {rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        {!anyMeasured ? (
          <div className="text-muted-foreground flex h-full min-h-[150px] flex-col items-center justify-center gap-1 text-center text-sm">
            <span>No measured productivity for this period.</span>
            <span className="text-xs">
              The line fills in once the desktop agent classifies app activity.
            </span>
          </div>
        ) : (
          <div className="h-full min-h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={CHART_MARGIN}>
                <defs>
                  <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillShare" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  {...xAxisLabel(rangeLabel)}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  // Both series are 0–100 (a score and a percentage) — one scale, so one axis. The
                  // label names the scale; the legend names each line.
                  domain={[0, 100]}
                  {...yAxisLabel("Score / % of active time")}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<TrendTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--chart-1)"
                  fill="url(#fillScore)"
                  strokeWidth={2}
                  // Break the line on an unmeasured day — never bridge a gap with an invented value.
                  connectNulls={false}
                  name="Productivity score"
                  dot={{ r: 2.5 }}
                />
                <Area
                  type="monotone"
                  dataKey="share"
                  stroke="var(--success)"
                  fill="url(#fillShare)"
                  strokeWidth={2}
                  connectNulls={false}
                  name="Productive share"
                  dot={{ r: 2.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Below the chart, not the header — the widget grid overlays drag/remove chrome top-right. */}
        <div className="mt-2 flex justify-end">
          <Link
            href="/insights/activity"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            Activity details
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
