"use client";

import { useState } from "react";
import { Flag, PieChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeltaPill } from "@/components/shared/delta-pill";
import { TickGauge } from "@/components/shared/tick-gauge";
import {
  DEPARTMENT_ATTENDANCE,
  OVERVIEW,
  TODAY,
  orgDayCounts,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

export function AttendanceOverview() {
  const c = orgDayCounts(TODAY.month, TODAY.day);
  const total = c.total;
  // "Present" counts everyone who showed up (on-time + late).
  const present = c.present + c.late;
  const rate = Math.round((present / total) * 1000) / 10;

  const presentPct = Math.round((present / total) * 100);
  const leavePct = Math.round((c.leave / total) * 100);
  const absentPct = 100 - presentPct - leavePct;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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

          {/* Stacked distribution bar */}
          <div className="space-y-2">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              <span
                className="bg-success transition-all"
                style={{ width: `${presentPct}%` }}
                title={`Present ${presentPct}%`}
              />
              <span
                className="bg-primary transition-all"
                style={{ width: `${leavePct}%` }}
                title={`On leave ${leavePct}%`}
              />
              <span
                className="bg-destructive/70 transition-all"
                style={{ width: `${absentPct}%` }}
                title={`Absent ${absentPct}%`}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {present} of {total} employees accounted for today
            </p>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 border-t pt-3">
            <LegendItem dot="bg-success" label="Present" value={`${presentPct}%`} />
            <LegendItem dot="bg-primary" label="On leave" value={`${leavePct}%`} />
            <LegendItem dot="bg-destructive" label="Absent" value={`${absentPct}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Department Attendance */}
      <DepartmentAttendance />
    </div>
  );
}

function DepartmentAttendance() {
  const [active, setActive] = useState(DEPARTMENT_ATTENDANCE[0].dept);
  const dept =
    DEPARTMENT_ATTENDANCE.find((d) => d.dept === active) ??
    DEPARTMENT_ATTENDANCE[0];

  return (
    <Card>
      <CardContent className="space-y-4 px-5">
        <SectionTitle icon={PieChart} title="Department Attendance" />

        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {DEPARTMENT_ATTENDANCE.map((d) => (
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
          <TickGauge value={dept.rate} label="Attendance rate" size={184} ticks={26} />
        </div>

        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <SubStat dot="bg-success" label="Present" value={dept.present} />
          <SubStat dot="bg-primary" label="On leave" value={dept.leave} />
          <SubStat dot="bg-destructive" label="Absent" value={dept.absent} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
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

function SubStat({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
