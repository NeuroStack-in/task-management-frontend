"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { MonitorSmartphone } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DayStatus } from "@/types/attendance";
import type { UserStatus } from "@/types/user";
import { cn } from "@/lib/utils";

/* --------------------------- Agent-pending widget --------------------------- */

/**
 * Compact, in-grid honest placeholder for insight widgets whose data comes from the
 * **desktop agent** (productivity, attendance) — which isn't reporting yet. We never seed
 * these with mock numbers; they populate once monitoring is live. (The full-page
 * `AgentPending` is too heavy for a widget cell, so this is the inline treatment.)
 */
function AgentPendingWidget({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-muted">
            <MonitorSmartphone className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">Waiting on the desktop agent</p>
          <p className="max-w-xs text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Productivity Heatmap ------------------------- */

// Agent-gated: hourly activity intensity needs the desktop agent's capture data, which no
// backend hook exposes yet. Renders an honest pending state instead of a seeded heatmap.
// Signature kept (`data: number[][]`) so a future real feed can drop in unchanged.
export function ProductivityHeatmap(_props: { data: number[][] }) {
  return (
    <AgentPendingWidget
      title="Productivity heatmap"
      detail="Hourly activity intensity across the week appears here once the desktop agent starts reporting."
    />
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

// Agent-gated: attendance is derived from the desktop agent's session data (present/partial/
// absent, late qualifier), which no backend hook exposes yet. Renders an honest pending state
// rather than seeded counts. Signature kept so a future real feed can drop in unchanged.
export function AttendanceDonut(_props: {
  counts: Record<DayStatus, number> & { late: number };
}) {
  return (
    <AgentPendingWidget
      title="Attendance"
      detail="Present, partial, leave and absence counts appear here once the desktop agent reports session data."
    />
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
