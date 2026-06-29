"use client";

import { useMemo, useState } from "react";
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
  REFERENCE_MONTH,
  TODAY,
  WEEKDAY_LABELS,
  monthMatrix,
  type DayCell,
} from "@/lib/mock-attendance";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Download the visible month's per-day org attendance as a CSV. */
function downloadMonthCsv(year: number, month: number, weeks: DayCell[][]) {
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
  toast.success("Attendance downloaded", {
    description: `${file} · ${days.length} working days`,
  });
}

interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

type CalendarMode = "detailed";

/** Years selectable in the calendar header, centred on the reference year. */
const YEARS = Array.from(
  { length: 6 },
  (_, i) => REFERENCE_MONTH.year - 4 + i,
);

export function AttendanceCalendar({
  selected,
  onSelect,
}: {
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
}) {
  const [view, setView] = useState({
    year: REFERENCE_MONTH.year,
    month: REFERENCE_MONTH.month,
  });
  const mode: CalendarMode = "detailed";

  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view]);

  const goToToday = () => {
    setView({ year: TODAY.year, month: TODAY.month });
    onSelect({ year: TODAY.year, month: TODAY.month, day: TODAY.day });
  };

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
        <CardTitle>
          {MONTH_NAMES[view.month]} {view.year}
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(view.month)}
            onValueChange={(v) => setView((s) => ({ ...s, month: Number(v) }))}
          >
            <SelectTrigger aria-label="Select month" className="h-9 w-36">
              <SelectValue>{(v) => MONTH_NAMES[Number(v)]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-36">
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(view.year)}
            onValueChange={(v) => setView((s) => ({ ...s, year: Number(v) }))}
          >
            <SelectTrigger aria-label="Select year" className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-28">
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Previous month"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next month"
              onClick={() => step(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadMonthCsv(view.year, view.month, weeks)}
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
              mode={mode}
              selected={selected}
              onSelect={onSelect}
            />
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

function DayCellView({
  cell,
  mode,
  selected,
  onSelect,
}: {
  cell: DayCell;
  mode: CalendarMode;
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
}) {
  if (!cell.isWorkday) {
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-[4.25rem] flex-col rounded-lg p-2",
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
        "flex min-h-[4.25rem] flex-col gap-1 rounded-lg bg-card p-2 text-left ring-1 ring-border transition-all hover:shadow-sm hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <span className="bg-success" style={{ width: `${presentPct}%` }} />
          <span className="bg-primary" style={{ width: `${leavePct}%` }} />
          <span className="bg-destructive" style={{ width: `${absentPct}%` }} />
        </div>
      </div>
    </button>
  );
}
