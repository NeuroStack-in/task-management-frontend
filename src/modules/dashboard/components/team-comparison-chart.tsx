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
import { CHART_MARGIN, xAxisLabel, yAxisLabel } from "@/components/shared/chart-axis";
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

/**
 * Cross-department productivity comparison.
 *
 * **Deliberately ignores the dashboard's department filter** — scoping it would leave a single bar,
 * which is not a comparison. The description says "always org-wide" because a chart that visibly
 * ignores the active filter is otherwise indistinguishable from a broken one.
 */
export function TeamComparisonChart({ data }: { data: TeamDatum[] }) {
  // Per-team scores come from the desktop agent's activity data. With no agent reporting there is
  // nothing to compare — show an honest empty state rather than an empty axis or a seeded bar.
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team comparison</CardTitle>
          <CardDescription>
            Average productivity score (0-100) by department — always org-wide
          </CardDescription>
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
        <CardDescription>
            Average productivity by department — always org-wide
          </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-full min-h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="team"
                {...xAxisLabel("Department")}
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[0, 100]}
                // The number is a score, not a percentage of anything — naming the range is what
                // tells a first-time reader whether 68 is good.
                {...yAxisLabel("Avg score (0–100)")}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                // Without this the tooltip read "score : 68" — the raw data key, and a bare number
                // with no unit on a 0-100 axis that could equally be a percentage or hours.
                formatter={(v: number) => [`${v} / 100`, "Avg productivity score"]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar
                dataKey="score"
                name="Avg productivity score"
                radius={[8, 8, 0, 0]}
                maxBarSize={44}
              >
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
