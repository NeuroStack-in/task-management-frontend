"use client";

import {
  Bar,
  BarChart,
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
import type { DailyHours } from "@/lib/mock-time";

/** Weekly tracked hours, split billable vs non-billable (stacked). */
export function WeeklyHoursChart({ data }: { data: DailyHours[] }) {
  const chartData = data.map((d) => ({
    day: d.day,
    billable: Math.round(d.billable * 10) / 10,
    other: Math.round((d.hours - d.billable) * 10) / 10,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardDescription>Hours tracked per day · billable vs other</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
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
        </div>
      </CardContent>
    </Card>
  );
}
