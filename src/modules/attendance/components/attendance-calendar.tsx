"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COUNT_METRICS,
  MONTH_NAMES,
  TODAY,
  WEEKDAY_LABELS,
  monthMatrix,
  type DayCell,
} from "@/lib/mock-attendance";
import { downloadBlob } from "@/lib/download";
import { LogDatePicker } from "./attendance-log";
import { cn } from "@/lib/utils";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Export the visible month's per-day org attendance as a CSV. */
function exportMonthCsv(year: number, month: number, weeks: DayCell[][]) {
  const days = weeks.flat().filter((c) => c.isWorkday && c.counts);
  const data = days.map((c) => {
    const k = c.counts!;
    const rate = Math.round(((k.present + k.late) / k.total) * 100);
    return [
      `${c.year}-${pad2(c.month + 1)}-${pad2(c.day)}`,
      WEEKDAY_LABELS[c.weekday],
      k.present,
      k.late,
      k.leave,
      k.absent,
      k.total,
      `${rate}%`,
    ];
  });
  const csv = Papa.unparse({
    fields: ["Date", "Weekday", "Present", "Late", "On leave", "Absent", "Total", "Attendance %"],
    data,
  });
  const file = `attendance-${MONTH_NAMES[month].toLowerCase()}-${year}.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), file);
  toast.success("Attendance exported", {
    description: `${file} · ${days.length} working days`,
  });
}

interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

export function AttendanceCalendar({
  selected,
  onSelect,
  dept,
  onDeptChange,
  departments,
}: {
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
  dept: string;
  onDeptChange: (d: string) => void;
  departments: string[];
}) {
  // The displayed month follows the selected date — single source of truth, now
  // that the header date picker is the only month/date control.
  const view = { year: selected.year, month: selected.month };
  const weeks = useMemo(
    () => monthMatrix(view.year, view.month),
    [view.year, view.month],
  );

  const goToToday = () => onSelect({ ...TODAY });

  // Prev/next move the selection by one month, clamping the day to the new
  // month's length; the grid follows because the view derives from the selection.
  const step = (dir: -1 | 1) => {
    let m = selected.month + dir;
    let y = selected.year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    const lastDay = new Date(y, m + 1, 0).getDate();
    onSelect({ year: y, month: m, day: Math.min(selected.day, lastDay) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Previous month"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <CardTitle className="min-w-[10rem] text-center">
            {MONTH_NAMES[view.month]} {view.year}
          </CardTitle>
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

        <div className="flex flex-wrap items-center gap-2">
          <Select value={dept} onValueChange={(v) => onDeptChange(v as string)}>
            <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Department">
              <SelectValue>
                {(v) =>
                  v == null || v === "all" ? "All departments" : String(v)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d === "all" ? "All departments" : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <LogDatePicker value={selected} onChange={onSelect} />

          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportMonthCsv(view.year, view.month, weeks)}
          >
            <Download className="size-4" /> Download
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
            <DayCellView
              key={i}
              cell={cell}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>

        {/* Legend + hint */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
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
          <span className="text-xs text-muted-foreground">
            Select a day to view its log below ↓
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DayCellView({
  cell,
  selected,
  onSelect,
}: {
  cell: DayCell;
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
}) {
  if (!cell.isWorkday) {
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-[4.25rem] flex-col rounded-xl p-2",
          !cell.inMonth && "opacity-50",
        )}
      >
        <span
          className={cn(
            "text-xs font-semibold leading-none tabular-nums",
            cell.inMonth
              ? "text-muted-foreground"
              : "text-muted-foreground/50",
          )}
        >
          {cell.day}
        </span>
      </div>
    );
  }

  const c = cell.counts!;
  const present = c.present + c.late;
  const rate = Math.round((present / c.total) * 100);
  const presentPct = (present / c.total) * 100;
  const leavePct = (c.leave / c.total) * 100;
  const absentPct = Math.max(0, 100 - presentPct - leavePct);

  const isSelected =
    cell.inMonth &&
    selected.year === cell.year &&
    selected.month === cell.month &&
    selected.day === cell.day;

  const title = `${cell.day}: ${present} in · ${c.leave} on leave · ${c.absent} absent`;

  return (
    <button
      type="button"
      onClick={() =>
        onSelect({ year: cell.year, month: cell.month, day: cell.day })
      }
      title={title}
      className={cn(
        "flex min-h-[4.25rem] flex-col gap-1 rounded-xl bg-card p-2 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        cell.isToday && !isSelected && "ring-primary/60",
        isSelected && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={cn(
            "text-sm font-semibold leading-none tabular-nums",
            cell.isToday ? "text-primary" : "text-foreground",
          )}
        >
          {cell.day}
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold leading-none tabular-nums",
            rate >= 90
              ? "text-success"
              : rate >= 75
                ? "text-warning"
                : "text-destructive",
          )}
        >
          {rate}%
        </span>
      </div>

      <div className="mt-auto space-y-1">
        <p className="text-[11px] leading-none text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {present}
          </span>{" "}
          in
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="bg-success" style={{ width: `${presentPct}%` }} />
          <span className="bg-primary" style={{ width: `${leavePct}%` }} />
          <span className="bg-destructive" style={{ width: `${absentPct}%` }} />
        </div>
      </div>
    </button>
  );
}
