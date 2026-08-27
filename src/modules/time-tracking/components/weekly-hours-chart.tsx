"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_MARGIN, xAxisLabel, yAxisLabel } from "@/components/shared/chart-axis";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours } from "@/lib/format";
import { MAX_WEEKS_BACK, useWeeklyHours } from "../use-weekly-hours";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

/** Monday–Sunday date range for a week `offset` weeks from `base`. */
function weekRangeLabel(base: Date, offset: number): string {
  const d = new Date(base);
  const mondayDelta = (d.getDay() + 6) % 7; // days since Monday
  d.setDate(d.getDate() - mondayDelta + offset * 7);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(d)} – ${fmt(end)}`;
}

/**
 * Weekly tracked hours from the real backend (`GET /v1/me/timesheet`), split billable vs other
 * (stacked). The arrows page through earlier weeks; "next" is disabled on the current week. A week
 * with no tracked time shows genuine zeros — not invented bars.
 */
export function WeeklyHoursChart() {
  const [offset, setOffset] = useState(0);
  // Resolve "now" on the client to avoid an SSR/hydration mismatch on the range label.
  const [baseDate, setBaseDate] = useState<Date | null>(null);
  useEffect(() => setBaseDate(new Date()), []);

  const { week, totalHoursFor, loading, error, reload } = useWeeklyHours();

  const data = week(offset);
  const chartData = data.map((d) => ({
    day: d.day,
    billable: d.billable,
    other: d.other,
  }));
  const totalHours = totalHoursFor(offset);

  const relLabel =
    offset === 0
      ? "This week"
      : offset === -1
        ? "Last week"
        : `${Math.abs(offset)} weeks ago`;
  const range = baseDate ? weekRangeLabel(baseDate, offset) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          {relLabel}
          <ChartLegendInfo
            label="What billable and other hours mean"
            terms={[
              {
                term: "Billable",
                definition:
                  "Hours logged against a project marked billable. Set per project, not per session.",
              },
              {
                term: "Other",
                definition:
                  "Everything else the timer recorded — non-billable projects, meetings and ad-hoc work.",
              },
            ]}
          />
          {!loading && !error ? (
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {formatHours(totalHours)}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Hours tracked per day · billable vs other
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-3">
            {range ? (
              <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                {range}
              </span>
            ) : null}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Previous week"
                onClick={() => setOffset((o) => Math.max(-MAX_WEEKS_BACK, o - 1))}
                disabled={offset <= -MAX_WEEKS_BACK}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Next week"
                onClick={() => setOffset((o) => Math.min(0, o + 1))}
                disabled={offset === 0}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
              <TriangleAlert className="size-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Couldn&apos;t load weekly hours</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  {...xAxisLabel("Day of week")}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  // Ticks already carry "h", but the bars are stacked billable + other, so the
                  // axis names what the stack height means rather than leaving it to the legend.
                  {...yAxisLabel("Hours logged")}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v) => `${v}h`}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(value: number, name) => [
                    `${value}h`,
                    name === "billable" ? "Billable" : "Other",
                  ]}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="billable"
                  stackId="h"
                  fill="var(--chart-1)"
                  maxBarSize={40}
                />
                <Bar
                  dataKey="other"
                  stackId="h"
                  fill="color-mix(in srgb, var(--primary) 24%, var(--muted))"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
