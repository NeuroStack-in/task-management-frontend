"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plane,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  COUNT_METRICS,
  MONTH_NAMES,
  REFERENCE_MONTH,
  WEEKDAY_LABELS,
  monthMatrix,
  monthSummary,
  type DayCell,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

export function AttendanceCalendar() {
  const [view, setView] = useState({
    year: REFERENCE_MONTH.year,
    month: REFERENCE_MONTH.month,
  });

  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view]);
  const summary = useMemo(
    () => monthSummary(view.year, view.month),
    [view],
  );

  const isRefMonth =
    view.year === REFERENCE_MONTH.year && view.month === REFERENCE_MONTH.month;

  const step = (dir: -1 | 1) =>
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>
            {MONTH_NAMES[view.month]} {view.year}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization attendance · {summary.total} employees · avg/day{" "}
            <span className="font-medium text-success">{summary.present} present</span>
            {" · "}
            <span className="font-medium text-primary">{summary.leave} on leave</span>
            {" · "}
            <span className="font-medium text-destructive">{summary.absent} absent</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setView({ year: REFERENCE_MONTH.year, month: REFERENCE_MONTH.month })
            }
            disabled={isRefMonth}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Previous month"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Next month"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {weeks.flat().map((cell, i) => (
            <DayCellView key={i} cell={cell} />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {COUNT_METRICS.map((m) => (
            <span
              key={m.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={cn("size-2.5 rounded-full", m.dot)} />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="wp-hatch size-2.5 rounded-full ring-1 ring-border" />
            Weekend / off
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DayCellView({ cell }: { cell: DayCell }) {
  if (!cell.isWorkday) {
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-20 flex-col rounded-xl p-1.5",
          !cell.inMonth && "opacity-50",
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold leading-none tabular-nums",
            cell.inMonth ? "text-muted-foreground" : "text-muted-foreground/60",
          )}
        >
          {cell.day}
        </span>
      </div>
    );
  }

  const c = cell.counts!;
  const title = `${cell.day}: ${c.present} present · ${c.late} late · ${c.leave} on leave · ${c.absent} absent`;

  return (
    <div
      title={title}
      className={cn(
        "flex min-h-20 flex-col gap-1.5 rounded-xl bg-card p-1.5 ring-1 ring-border transition-colors hover:ring-primary/40",
        cell.isToday && "ring-2 ring-primary",
      )}
    >
      <span
        className={cn(
          "text-sm font-semibold leading-none tabular-nums",
          cell.isToday ? "text-primary" : "text-foreground",
        )}
      >
        {cell.day}
      </span>

      {/* Three metric widgets */}
      <div className="mt-auto grid grid-cols-3 gap-1">
        {COUNT_METRICS.map((m) => (
          <div
            key={m.key}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-lg py-1",
              m.chip,
            )}
          >
            <CountIcon metric={m.key} />
            <span className="text-sm font-bold leading-none tabular-nums">
              {c[m.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const METRIC_ICON: Record<string, LucideIcon> = {
  present: Check,
  leave: Plane,
  absent: X,
};

function CountIcon({ metric }: { metric: string }) {
  const Icon = METRIC_ICON[metric];
  return <Icon className="size-2.5 shrink-0" />;
}
