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

const DATA = [
  { day: "Mon", active: 72, productive: 64 },
  { day: "Tue", active: 78, productive: 70 },
  { day: "Wed", active: 81, productive: 74 },
  { day: "Thu", active: 76, productive: 69 },
  { day: "Fri", active: 84, productive: 77 },
  { day: "Sat", active: 41, productive: 33 },
  { day: "Sun", active: 28, productive: 22 },
];

export function ProductivityChart() {
  return (
    <Card className="col-span-full xl:col-span-2">
      <CardHeader>
        <CardTitle>Productivity Trends</CardTitle>
        <CardDescription>Active vs. productive time, last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DATA} margin={{ left: -16, right: 8, top: 4 }}>
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
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
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
                name="Active %"
              />
              <Area
                type="monotone"
                dataKey="productive"
                stroke="var(--chart-2)"
                fill="url(#fillProductive)"
                strokeWidth={2}
                name="Productive %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
