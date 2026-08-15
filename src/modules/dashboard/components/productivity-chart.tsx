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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrendPoint } from "@/modules/dashboard/lib/dashboard-data";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

export function ProductivityChart({
  data,
  rangeLabel,
}: {
  data: TrendPoint[];
  rangeLabel: string;
}) {
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
                definition: "0–100 composite of utilisation, quality, focus and reliability.",
              },
              {
                term: "Productive share",
                definition: (
                  <>
                    Of <em>active</em> time (minutes with keyboard or mouse input), the percentage
                    spent in apps your rules classify as productive.
                  </>
                ),
              },
            ]}
          />
        </CardTitle>
        {/* Neither series is time. `active` is the four-term productivity score and `productive`
            is a share of active time — the old "Active vs. productive time" described neither, so
            a reader had no way to know the blue line was a score. */}
        <CardDescription>
          Score vs. productive share · {rangeLabel}
        </CardDescription>
        {/* The card was a dead end: two unexplained curves with nowhere to go for the detail
            behind them. The link is visible rather than a bare clickable card, because an
            undiscoverable click target is its own usability problem. */}
        <CardAction>
          <Link
            href="/insights/activity"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            Activity details
            <ArrowUpRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="h-full min-h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillProductive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
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
                // Both series are 0-100. Fixed so the axis reads the same every day, and so a bad
                // point stands out instead of quietly rescaling the whole chart around itself.
                domain={[0, 100]}
                // Two different 0–100 quantities share this axis (a score and a percentage), so the
                // label names the scale rather than either series — the legend names the series.
                {...yAxisLabel("Score / % of active time")}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
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
              {/* Two curves in two colours and no key at all — a reader could not tell which was
                  which, let alone what either measured. */}
              <Legend
                verticalAlign="top"
                height={26}
                iconType="plainline"
                wrapperStyle={{ fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="active"
                stroke="var(--chart-1)"
                fill="url(#fillActive)"
                strokeWidth={2}
                name="Productivity score"
              />
              <Area
                type="monotone"
                dataKey="productive"
                stroke="var(--chart-2)"
                fill="url(#fillProductive)"
                strokeWidth={2}
                name="Productive share"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
