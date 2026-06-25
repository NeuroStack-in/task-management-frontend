"use client";

import { useState } from "react";
import { Clock, Flag, PieChart, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeltaPill } from "@/components/shared/delta-pill";
import { TickGauge } from "@/components/shared/tick-gauge";
import {
  DEPARTMENT_PERFORMANCE,
  OVERVIEW,
  TODAY,
  orgDayCounts,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

const BARS = 34;

export function AttendanceOverview() {
  const c = orgDayCounts(TODAY.month, TODAY.day);
  const total = c.total;
  const attended = c.present + c.late;
  const rate = Math.round((attended / total) * 1000) / 10;

  const onTimePct = Math.round((c.present / total) * 100);
  const latePct = Math.round((c.late / total) * 100);
  const notInPct = 100 - onTimePct - latePct;

  // Distribute the bar chart across the three segments.
  const onTimeBars = Math.round((c.present / total) * BARS);
  const lateBars = Math.round((c.late / total) * BARS);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr_1.4fr]">
      {/* Today's Attendance */}
      <Card>
        <CardContent className="space-y-4 px-5">
          <SectionTitle icon={Flag} title="Today's Attendance" />

          <div className="flex items-center gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {rate}%
            </span>
            <DeltaPill value={OVERVIEW.rateDelta} />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Attendance Rate</p>

          {/* Bar distribution */}
          <div className="flex h-24 items-end gap-[3px]">
            {Array.from({ length: BARS }, (_, i) => {
              const seg =
                i < onTimeBars
                  ? "bg-primary"
                  : i < onTimeBars + lateBars
                    ? "bg-warning"
                    : "bg-muted";
              const h = 58 + ((i * 11) % 34) - (i / BARS) * 18;
              return (
                <div
                  key={i}
                  className={cn("flex-1 rounded-full", seg)}
                  style={{ height: `${Math.max(28, h)}%` }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <LegendItem dot="bg-primary" label="On-Time" value={`${onTimePct}%`} />
            <LegendItem dot="bg-warning" label="Late" value={`${latePct}%`} />
            <LegendItem dot="bg-muted" label="Not Attend Yet" value={`${notInPct}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Employee Attend + Total Log Hours */}
      <div className="grid gap-4">
        <Card>
          <CardContent className="space-y-3 px-5">
            <SectionTitle icon={Users} title="Employee Attend" />
            <p className="font-display text-3xl font-semibold tabular-nums">
              {attended.toLocaleString()}
              <span className="text-lg font-normal text-muted-foreground">
                /{total.toLocaleString()}
              </span>
            </p>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Last Week</span>
              <DeltaPill value={OVERVIEW.attendedDelta} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 px-5">
            <SectionTitle icon={Clock} title="Total Log Hours" />
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {OVERVIEW.logHours}
              <span className="text-base font-normal text-muted-foreground">
                /{OVERVIEW.logHoursTarget}
              </span>
            </p>
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Last Week</span>
              <DeltaPill value={OVERVIEW.logHoursDelta} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Working Hour Performance */}
      <WorkingHourPerformance />
    </div>
  );
}

function WorkingHourPerformance() {
  const [active, setActive] = useState(DEPARTMENT_PERFORMANCE[0].dept);
  const dept =
    DEPARTMENT_PERFORMANCE.find((d) => d.dept === active) ??
    DEPARTMENT_PERFORMANCE[0];

  return (
    <Card>
      <CardContent className="space-y-4 px-5">
        <SectionTitle icon={PieChart} title="Working Hour Performance" />

        {/* Department tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {DEPARTMENT_PERFORMANCE.map((d) => (
            <button
              key={d.dept}
              type="button"
              onClick={() => setActive(d.dept)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                active === d.dept
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d.dept}
            </button>
          ))}
        </div>

        <div className="flex justify-center py-1">
          <TickGauge value={dept.rate} label="It's already great!" size={184} ticks={26} />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Employee Perf.</p>
            <p className="font-display text-lg font-semibold tabular-nums">
              {dept.perf}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Working Hour</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {dept.hours}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof Users;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
        <Icon className="size-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function LegendItem({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
