"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Grid3x3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AttendanceStatus,
  HeadcountCounts,
} from "@/modules/dashboard/lib/dashboard-data";
import { cn } from "@/lib/utils";

/** Heatmap axis labels (formerly from mock-metrics) — pure labels, no seeded data. */
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_HOURS = ["8am", "10am", "12pm", "2pm", "4pm", "6pm"];

/* ------------------------- Productivity Heatmap ------------------------- */

export function ProductivityHeatmap({ data }: { data: number[][] }) {
  // **This measures when work happened, not how productive it was**, which is why it is titled
  // "Activity heatmap". `use-dashboard-data` builds it from **screenshot capture density** — the
  // agent captures periodically, so a busy cell means frames were taken then, and nothing about
  // their category. There is no per-hour *score* to plot: the scorer stores daily totals.
  //
  // Cells are **relative intensity**, normalised against the busiest cell in the window — so the
  // scale is "compared with this org's own peak", never a percentage of anything. Calling it a
  // productivity percentage was two claims the data does not support.
  //
  // Empty is honest, not a placeholder: no captures in the window means nothing to draw.
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity heatmap</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="bg-muted flex size-10 items-center justify-center rounded-md">
              <Grid3x3 className="text-muted-foreground size-5" />
            </span>
            <p className="text-sm font-medium">No captures in this window</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              When work happens across the week appears here, built from the frames the
              desktop agent captures. Nothing was captured in the selected range.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity heatmap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {data.map((row, d) => (
          <div key={HEATMAP_DAYS[d]} className="flex items-center gap-2">
            <span className="text-muted-foreground w-8 shrink-0 text-xs">
              {HEATMAP_DAYS[d]}
            </span>
            <div className="flex flex-1 gap-1">
              {row.map((v, h) => (
                <div
                  key={h}
                  // Relative to the busiest cell in the window — not a percentage of a total, and
                  // not a score. Saying "%" invited both readings.
                  title={`${HEATMAP_DAYS[d]} · ${v}/100 of peak capture activity`}
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
              className="text-muted-foreground flex-1 text-center text-[10px]"
            >
              {h}
            </span>
          ))}
        </div>
        <div className="text-muted-foreground flex items-center justify-end gap-1.5 pt-1 text-[10px]">
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
          <span className="font-display text-2xl leading-none font-semibold tabular-nums">
            {center}
          </span>
          <span className="text-muted-foreground mt-1 text-xs">{caption}</span>
        </div>
      </div>
      <ul className={cn("w-full space-y-2", layout === "row" && "sm:flex-1")}>
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-muted-foreground flex-1">{s.label}</span>
            <span className="tabular-nums">
              <span className="font-medium">{s.value}</span>
              <span className="text-muted-foreground text-xs">
                {" "}
                - {Math.round((s.value / total) * 100)}%
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

  // Nothing resolved => say so. Attendance statuses are stamped by the 00:15 close cron, so a range
  // covering only today has no record yet. Dividing by `total || 1` turned that into a confident
  // "0% clocked in" sitting beside a live productivity score — the number read as "nobody came in"
  // when it actually meant "not computed yet".
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-6 text-center text-sm">
            No attendance resolved for this range yet.
            <br />
            <span className="text-xs">
              Days are classified by the nightly close, so today appears here tomorrow.
            </span>
          </p>
        </CardContent>
      </Card>
    );
  }

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

/**
 * A two-slice donut. **The labels are required** — this widget is used for two genuinely different
 * facts and hardcoding "Active/Inactive" made them look like one:
 *
 *  - the dashboard shows **employment status** (on the books vs deactivated);
 *  - Insights → Activity shows **who reported** (an agent produced a score vs it didn't).
 *
 * "Inactive" was doing duty for both "no longer employed" and "no agent data", which are unrelated.
 * Callers now have to say which they mean.
 */
export function ActiveInactiveRing({
  active,
  inactive,
  activeLabel,
  inactiveLabel,
  title,
  caption,
  layout,
  note,
}: {
  active: number;
  inactive: number;
  activeLabel: string;
  inactiveLabel: string;
  title: string;
  /** Word under the centre percentage — what the percentage is *of*. */
  caption: string;
  layout?: "column" | "row";
  /** Optional qualifier under the donut — e.g. that a multi-day figure is the period's peak day. */
  note?: string;
}) {
  const total = active + inactive || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <Donut
          center={`${Math.round((active / total) * 100)}%`}
          caption={caption}
          layout={layout}
          slices={[
            { label: activeLabel, value: active, color: "var(--primary)" },
            { label: inactiveLabel, value: inactive, color: "var(--muted-foreground)" },
          ]}
        />
        {note ? <p className="text-muted-foreground mt-3 text-xs">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------- Headcount by status ------------------------- */

/**
 * The buckets the **server** can actually distinguish — see `HeadcountCounts`.
 *
 * There used to be a fourth, `suspended`, rendered as a permanent "0 · 0%" row: the backend has no
 * such state and never emits one. (It survives in `UserStatus` only because the Faker seed still
 * generates it for the projects/tasks fixtures.) `invited` was equally misleading — it was hardcoded
 * to 0 while invited people were being counted under `inactive`.
 */
const STATUS_LABEL: Record<keyof HeadcountCounts, { label: string; color: string }> = {
  active: { label: "Active", color: "var(--success)" },
  inactive: { label: "Deactivated", color: "var(--muted-foreground)" },
  invited: { label: "Invited", color: "var(--warning)" },
};

export function HeadcountStatus({ counts }: { counts: HeadcountCounts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const order: (keyof HeadcountCounts)[] = ["active", "inactive", "invited"];
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
              <div className={cn("bg-muted h-2 overflow-hidden rounded-full")}>
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
