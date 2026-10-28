"use client";

import { useState } from "react";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Grid3x3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import type {
  AttendanceStatus,
  AttendanceView,
  HeadcountCounts,
} from "@/modules/dashboard/lib/dashboard-data";
import { useWorkdays } from "@/hooks/use-working-hours";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { isWorkday } from "@/lib/workdays";
import { cn } from "@/lib/utils";

/** Heatmap axis labels (formerly from mock-metrics) — pure labels, no seeded data. */
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_HOURS = ["8am", "10am", "12pm", "2pm", "4pm", "6pm"];

/* ------------------------- Productivity Heatmap ------------------------- */

export function ProductivityHeatmap({
  data,
  sampled = false,
}: {
  data: number[][];
  /**
   * The window held more captures than the dashboard reads per day (one page, ordered by person).
   * A grid drawn from that page would be a few people's day captioned as the org's, so none is
   * drawn (QA audit 2026-10-08, WP-197).
   */
  sampled?: boolean;
}) {
  if (sampled) {
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
            <p className="text-sm font-medium">Too many captures to chart here</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              This window holds more screenshots than the dashboard reads per day, so a pattern
              drawn from them would show only a few people. Every capture is under Analytics →
              Screenshots.
            </p>
            <Link
              href="/insights/screenshots"
              className="text-primary text-xs font-medium hover:underline"
            >
              Open screenshots
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }
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
        {/* A grid of coloured squares tells a first-time reader nothing on its own: not what a cell
            counts, not what "darker" means, and not what it is relative to. All three have to be
            said, because none of them can be inferred from the picture. */}
        <CardDescription>
          Weekday (rows) × hour of day (columns) · darker = more screenshot captures, relative to
          this org&apos;s own busiest hour
        </CardDescription>
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
                  // The value was a background colour and a hover title only — nothing a screen
                  // reader or a keyboard could reach (QA audit 2026-10-08, WP-439).
                  role="img"
                  aria-label={`${HEATMAP_DAYS[d]} from ${HEATMAP_HOURS[h]}: ${v} of 100 of peak capture activity`}
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
        <p className="text-muted-foreground pt-0.5 pl-10 text-center text-[10px]">
          Hour of day
        </p>
        <div className="text-muted-foreground flex items-center justify-end gap-1.5 pt-1 text-[10px]">
          <span>Fewer captures</span>
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
  // Hovering a slice shows it in the middle of the ring. A floating tooltip landed on top of the
  // centre figure and hid it ("Clocked in : 1 person" over "17% clocked in", 2026-10-28).
  const [hovered, setHovered] = useState<number | null>(null);
  const hot = hovered !== null ? slices[hovered] : undefined;
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
              // `nameKey` so a hovered slice says "Present", not the data key "value". These are
              // counts of people, and the tooltip says so — a bare "4" beside a ring reads just as
              // easily as a percentage of the ring.
              nameKey="label"
              innerRadius="60%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
              onMouseEnter={(_, i) => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Recharts draws each slice as `<path role="img">`; the Cell's props land on it, so
                  this is the slice's text alternative (QA audit 2026-10-08, WP-116). */}
              {slices.map((s) => (
                <Cell
                  key={s.label}
                  fill={s.color}
                  aria-label={`${s.label}: ${s.value} ${s.value === 1 ? "person" : "people"}`}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl leading-none font-semibold tabular-nums">
            {hot ? hot.value : center}
          </span>
          <span className="text-muted-foreground mt-1 max-w-[60%] text-center text-xs">
            {hot
              ? `${hot.label} · ${Math.round((hot.value / total) * 100)}%`
              : caption}
          </span>
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

/** `YYYY-MM-DD` → "Tue, Oct 7" — the day a closed-day donut describes. */
function dayName(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function AttendanceDonut({
  counts,
  view,
}: {
  counts: Record<AttendanceStatus, number>;
  /** What the counts describe — see `AttendanceView`. `null` when nothing is resolved yet. */
  view: AttendanceView | null;
}) {
  const workdays = useWorkdays();
  const holidays = useOrgHolidays();
  const total = counts.present + counts.partial + counts.leave + counts.absent;
  const presentPct = Math.round(((counts.present + counts.partial) / (total || 1)) * 100);

  // Today, on a day nobody is scheduled: everyone is "not clocked in", and a donut saying so is a
  // red ring that measures nothing. Say what the day is instead.
  if (view?.source === "live" && total > 0) {
    const holiday = holidays.nameFor(view.day);
    if (holiday || !isWorkday(new Date(`${view.day}T00:00:00`), workdays)) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground py-6 text-center text-sm">
              {holiday ? `Today is a holiday — ${holiday}.` : "Today isn't a working day."}
              <br />
              <span className="text-xs">
                Nobody is expected in, so there is no attendance to show for it.
              </span>
            </p>
          </CardContent>
        </Card>
      );
    }
  }

  // Nothing resolved => say so. Attendance statuses are stamped by the 00:15 close cron, so a range
  // covering only today has no record yet. Dividing by `total || 1` turned that into a confident
  // "0% clocked in" sitting beside a live productivity score — the number read as "nobody came in"
  // when it actually meant "not computed yet".
  if (total === 0 || !view) {
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

  // **Today so far** — no verdict exists yet, so nobody here is "absent": they have not clocked in
  // *yet*, and that slice is neutral, not red (QA audit 2026-10-08, WP-109).
  if (view.source === "live") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>
            Today so far: who has clocked in, of {total} people who track time. The day&apos;s
            statuses are settled after it ends.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Donut
            center={`${presentPct}%`}
            caption="clocked in"
            slices={[
              { label: "Clocked in", value: counts.present, color: "var(--success)" },
              { label: "On leave", value: counts.leave, color: "var(--muted-foreground)" },
              {
                label: "Not clocked in yet",
                value: counts.absent,
                color: "color-mix(in srgb, var(--muted-foreground) 35%, var(--muted))",
              },
            ]}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        {/* The centre reads a bare percentage. Of what, out of how many, and for when are all
            invisible without saying so — and "for when" matters here, because a day only gets a
            status from the nightly close. It is ONE day, even when the window is a week: the
            latest closed day with statuses, named here so it is not read as the range's rate. */}
        <CardDescription>
          {dayName(view.day)}: share of the team present or partially present, out of {total}{" "}
          people with a resolved day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Donut
          center={`${presentPct}%`}
          caption="present"
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
  description,
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
  /** One line naming the measure and its period. The ring is generic; only the caller knows. */
  description?: string;
  layout?: "column" | "row";
  /** Optional qualifier under the donut — e.g. that a multi-day figure is the period's peak day. */
  note?: string;
}) {
  const total = active + inactive || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
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
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  // `|| 1` only as the divisor: it was the headline too, so an empty department read "1" above
  // three "0 · 0%" rows (QA audit 2026-10-08, WP-436).
  const divisor = total || 1;
  const order: (keyof HeadcountCounts)[] = ["active", "inactive", "invited"];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount by status</CardTitle>
        <CardDescription>
          Everyone in the directory, split by account status &mdash; not attendance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-display text-3xl font-semibold tabular-nums">{total}</p>
        {order.map((s) => {
          const meta = STATUS_LABEL[s];
          const pct = Math.round((counts[s] / divisor) * 100);
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
