"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Grid3x3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserStatus } from "@/types/user";
import type { AttendanceStatus } from "@/modules/dashboard/lib/dashboard-data";
import { cn } from "@/lib/utils";

/** Heatmap axis labels (formerly from mock-metrics) — pure labels, no seeded data. */
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_HOURS = ["8a", "10a", "12p", "2p", "4p", "6p"];

/* ------------------------- Productivity Heatmap ------------------------- */

export function ProductivityHeatmap({ data }: { data: number[][] }) {
  // There is no per-hour productivity endpoint — hourly intensity needs the desktop agent's capture
  // data, which no backend read exposes yet. With no rows, show an honest empty state rather than a
  // seeded grid. The `number[][]` signature is kept so a future real feed drops in unchanged.
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productivity heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Grid3x3 className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">Hourly activity pending</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              When the team is most productive across the week appears here once the desktop agent
              reports the hourly activity it captures.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity heatmap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {data.map((row, d) => (
          <div key={HEATMAP_DAYS[d]} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs text-muted-foreground">
              {HEATMAP_DAYS[d]}
            </span>
            <div className="flex flex-1 gap-1">
              {row.map((v, h) => (
                <div
                  key={h}
                  title={`${HEATMAP_DAYS[d]} · ${v}%`}
                  className="h-4 flex-1 rounded-[4px]"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--success) ${v}%, var(--muted))`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 pl-10">
          {HEATMAP_HOURS.map((h, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {h}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[18, 40, 62, 84, 100].map((v) => (
            <span
              key={v}
              className="size-3 rounded-[3px]"
              style={{
                backgroundColor: `color-mix(in srgb, var(--success) ${v}%, var(--muted))`,
              }}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Donut helper --------------------------- */

function Donut({
  slices,
  center,
  caption,
  layout = "column",
}: {
  slices: { label: string; value: number; color: string }[];
  center: string;
  caption: string;
  /** "column" stacks the legend below the ring (dashboard widgets); "row"
   *  puts the legend beside it (wide half-width cards, e.g. Analytics). */
  layout?: "column" | "row";
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    // The ring grows to fill all space above/beside the legend (flex-1 +
    // percentage radii), so the card is used efficiently — no dead band.
    <div
      className={cn(
        "flex h-full flex-col gap-3",
        layout === "row" && "sm:flex-row sm:items-center sm:gap-6",
      )}
    >
      <div
        className={cn(
          "relative min-h-[150px] w-full flex-1",
          layout === "row" && "sm:h-44 sm:w-auto",
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius="60%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold leading-none tabular-nums">
            {center}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{caption}</span>
        </div>
      </div>
      <ul className={cn("w-full space-y-2", layout === "row" && "sm:flex-1")}>
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="tabular-nums">
              <span className="font-medium">{s.value}</span>
              <span className="text-xs text-muted-foreground">
                {" "}- {Math.round((s.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------- Attendance donut --------------------------- */

export function AttendanceDonut({
  counts,
}: {
  counts: Record<AttendanceStatus, number>;
}) {
  const total = counts.present + counts.partial + counts.leave + counts.absent;
  const presentPct = Math.round(((counts.present + counts.partial) / (total || 1)) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
      </CardHeader>
      <CardContent>
        <Donut
          center={`${presentPct}%`}
          caption="clocked in"
          slices={[
            { label: "Present", value: counts.present, color: "var(--success)" },
            { label: "Partial", value: counts.partial, color: "var(--warning)" },
            { label: "On leave", value: counts.leave, color: "var(--muted-foreground)" },
            { label: "Absent", value: counts.absent, color: "var(--destructive)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------- Active vs inactive ring ------------------------- */

export function ActiveInactiveRing({
  active,
  inactive,
  layout,
}: {
  active: number;
  inactive: number;
  layout?: "column" | "row";
}) {
  const total = active + inactive || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active vs inactive</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <Donut
          center={`${Math.round((active / total) * 100)}%`}
          caption="active"
          layout={layout}
          slices={[
            { label: "Active", value: active, color: "var(--primary)" },
            { label: "Inactive", value: inactive, color: "var(--muted-foreground)" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------- Headcount by status ------------------------- */

const STATUS_LABEL: Record<UserStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "var(--success)" },
  inactive: { label: "Inactive", color: "var(--muted-foreground)" },
  invited: { label: "Invited", color: "var(--warning)" },
  suspended: { label: "Suspended", color: "var(--destructive)" },
};

export function HeadcountStatus({
  counts,
}: {
  counts: Record<UserStatus, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const order: UserStatus[] = ["active", "inactive", "invited", "suspended"];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount by status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-display text-3xl font-semibold tabular-nums">{total}</p>
        {order.map((s) => {
          const meta = STATUS_LABEL[s];
          const pct = Math.round((counts[s] / total) * 100);
          return (
            <div key={s} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{meta.label}</span>
                <span className="font-medium tabular-nums">
                  {counts[s]} · {pct}%
                </span>
              </div>
              <div className={cn("h-2 overflow-hidden rounded-full bg-muted")}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: meta.color }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
