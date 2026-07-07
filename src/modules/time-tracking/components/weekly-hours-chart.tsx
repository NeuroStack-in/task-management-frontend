"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatHours, weeklyHoursFor } from "@/lib/mock-time";

/** How many weeks back the user can page. */
const MAX_BACK = 11;

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
 * Weekly tracked hours, split billable vs non-billable (stacked). The arrows
 * page through earlier weeks; "next" is disabled on the current week.
 */
export function WeeklyHoursChart() {
  const [offset, setOffset] = useState(0);
  // Resolve "now" on the client to avoid an SSR/hydration mismatch on the range.
  const [baseDate, setBaseDate] = useState<Date | null>(null);
  useEffect(() => setBaseDate(new Date()), []);

  const data = weeklyHoursFor(offset);
  const chartData = data.map((d) => ({
    day: d.day,
    billable: Math.round(d.billable * 10) / 10,
    other: Math.round((d.hours - d.billable) * 10) / 10,
  }));
  const totalHours = data.reduce((s, d) => s + d.hours, 0);

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
          <span className="font-mono text-sm font-normal text-muted-foreground">
            {formatHours(totalHours)}
          </span>
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
                onClick={() => setOffset((o) => Math.max(-MAX_BACK, o - 1))}
                disabled={offset <= -MAX_BACK}
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
