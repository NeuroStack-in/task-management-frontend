"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  type AttendanceStatus,
} from "@/lib/mock-metrics";
import type { UserStatus } from "@/types/user";
import { cn } from "@/lib/utils";

/* ------------------------- Productivity Heatmap ------------------------- */

export function ProductivityHeatmap({ data }: { data: number[][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Productivity Heatmap</CardTitle>
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
                  className="h-5 flex-1 rounded-[4px]"
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
}: {
  slices: { label: string; value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={38}
              outerRadius={54}
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
          <span className="font-display text-xl font-semibold tabular-nums">
            {center}
          </span>
          <span className="text-[10px] text-muted-foreground">{caption}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}</span>
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round((s.value / total) * 100)}%
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
  const total = counts.present + counts.late + counts.leave + counts.absent;
  const presentPct = Math.round(((counts.present + counts.late) / (total || 1)) * 100);
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
            { label: "Late", value: counts.late, color: "var(--warning)" },
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
}: {
  active: number;
  inactive: number;
}) {
  const total = active + inactive || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active vs Inactive</CardTitle>
      </CardHeader>
      <CardContent>
        <Donut
          center={`${Math.round((active / total) * 100)}%`}
          caption="active"
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
        <CardTitle>Headcount by Status</CardTitle>
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
