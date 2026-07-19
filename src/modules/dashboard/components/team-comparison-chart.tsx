"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

interface TeamDatum {
  team: string;
  score: number;
}

export function TeamComparisonChart({ data }: { data: TeamDatum[] }) {
  // Per-team scores come from the desktop agent's activity data. With no agent reporting there is
  // nothing to compare — show an honest empty state rather than an empty axis or a seeded bar.
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team comparison</CardTitle>
          <CardDescription>Average productivity by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-10 text-center">
            <p className="text-sm font-medium">No team scores yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Per-department productivity appears here once the desktop agent reports activity data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const top = Math.max(...data.map((d) => d.score));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team comparison</CardTitle>
        <CardDescription>Average productivity by department</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-full min-h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="team"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={44}>
                {data.map((d) => (
                  <Cell
                    key={d.team}
                    fill={
                      d.score === top
                        ? "var(--chart-1)"
                        : "color-mix(in srgb, var(--primary) 28%, var(--muted))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
