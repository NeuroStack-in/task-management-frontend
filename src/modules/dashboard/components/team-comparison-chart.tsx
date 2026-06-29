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
  const top = Math.max(...data.map((d) => d.score));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Comparison</CardTitle>
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
