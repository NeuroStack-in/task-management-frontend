"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrendPoint } from "@/modules/dashboard/lib/dashboard-data";

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
        <CardTitle>Productivity trends</CardTitle>
        {/* Neither series is time. `active` is the four-term productivity score and `productive`
            is a share of active time — the old "Active vs. productive time" described neither, so
            a reader had no way to know the blue line was a score. */}
        <CardDescription>
          Score vs. productive share · {rangeLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-full min-h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
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
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                // Both series are 0-100. Fixed so the axis reads the same every day, and so a bad
                // point stands out instead of quietly rescaling the whole chart around itself.
                domain={[0, 100]}
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
