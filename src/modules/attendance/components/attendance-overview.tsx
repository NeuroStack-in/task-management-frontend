"use client";

import { useState } from "react";
import { Flag, PieChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DeltaPill } from "@/components/shared/delta-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEPARTMENT_ATTENDANCE,
  OVERVIEW,
  TODAY,
  orgDayCounts,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

const BARS = 48;

type View = "today" | "department";

export function AttendanceOverview() {
  const [view, setView] = useState<View>("today");
  const [activeDept, setActiveDept] = useState(DEPARTMENT_ATTENDANCE[0].dept);
  const dept =
    DEPARTMENT_ATTENDANCE.find((d) => d.dept === activeDept) ??
    DEPARTMENT_ATTENDANCE[0];

  const c = orgDayCounts(TODAY.month, TODAY.day);

  // Both views render the same graph; only the data behind it changes.
  const stats =
    view === "today"
      ? {
          // "Present" counts everyone who showed up (on-time + late).
          present: c.present + c.late,
          leave: c.leave,
          absent: c.total - (c.present + c.late) - c.leave,
          total: c.total,
          delta: OVERVIEW.rateDelta as number | null,
          asPercent: true,
        }
      : {
          present: dept.present,
          leave: dept.leave,
          absent: dept.absent,
          total: dept.present + dept.leave + dept.absent,
          delta: null,
          asPercent: false,
        };

  const rate = Math.round((stats.present / stats.total) * 1000) / 10;
  const presentPct = Math.round((stats.present / stats.total) * 100);
  const leavePct = Math.round((stats.leave / stats.total) * 100);
  const absentPct = 100 - presentPct - leavePct;

  const presentBars = Math.round((stats.present / stats.total) * BARS);
  const leaveBars = Math.round((stats.leave / stats.total) * BARS);

  const fmt = (count: number, pct: number) =>
    stats.asPercent ? `${pct}%` : String(count);

  return (
    <Card>
      <CardContent className="space-y-5 px-5">
        {/* Toolbar: view toggle + (department dropdown when in dept view) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
            <ToggleButton
              active={view === "today"}
              onClick={() => setView("today")}
              icon={Flag}
              label="Today's"
            />
            <ToggleButton
              active={view === "department"}
              onClick={() => setView("department")}
              icon={PieChart}
              label="Department"
            />
          </div>

          {view === "department" ? (
            <Select
              value={activeDept}
              onValueChange={(v) => setActiveDept(v as string)}
            >
              <SelectTrigger aria-label="Select department" className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-44">
                {DEPARTMENT_ATTENDANCE.map((d) => (
                  <SelectItem key={d.dept} value={d.dept}>
                    {d.dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {/* Headline rate */}
        <div className="flex items-center gap-2">
          <span className="font-display text-3xl font-semibold tabular-nums">
            {rate}%
          </span>
          {stats.delta !== null ? <DeltaPill value={stats.delta} /> : null}
          <span className="text-xs text-muted-foreground">Attendance rate</span>
        </div>

        {/* Distribution graph (same pattern for both views) */}
        <div className="flex h-28 items-end gap-[3px]">
          {Array.from({ length: BARS }, (_, i) => {
            const seg =
              i < presentBars
                ? "bg-success"
                : i < presentBars + leaveBars
                  ? "bg-primary"
                  : "bg-destructive/70";
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
          <LegendItem
            dot="bg-success"
            label="Present"
            value={fmt(stats.present, presentPct)}
          />
          <LegendItem
            dot="bg-primary"
            label="On leave"
            value={fmt(stats.leave, leavePct)}
          />
          <LegendItem
            dot="bg-destructive"
            label="Absent"
            value={fmt(stats.absent, absentPct)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
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
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
