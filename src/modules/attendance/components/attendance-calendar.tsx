"use client";

/**
 * Month calendar of org attendance — on the **live backend**.
 *
 * Restored from the pre-`10bd02d` mock calendar, but the per-day counts now come from real
 * `/v1/attendance/day` responses (via `useMonthAttendance`, which fans the day call out over the
 * month). The grid math is the surviving `lib/calendar.ts`; this file only overlays data and handles
 * selection. Each cell is guarded — a day with no summary (weekend, today-still-open, or a fetch that
 * failed) renders a neutral state rather than indexing into `undefined`.
 */
import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { MONTH_NAMES, WEEKDAY_LABELS, monthMatrix, type DayCell } from "../lib/calendar";
import type { ApiDayResponse, ApiDaySummary } from "../services/attendance.service";

interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** Present-rate over counted days. Guarded: no counted days → 0, never NaN. */
function rateOf(s: ApiDaySummary): number {
  return s.counted ? Math.round((s.present / s.counted) * 100) : 0;
}

function exportMonthCsv(
  year: number,
  month: number,
  weeks: DayCell[][],
  days: Map<string, ApiDayResponse>,
) {
  const rows = weeks
    .flat()
    .filter((c) => c.inMonth && c.isWorkday)
    .map((c) => {
      const s = days.get(isoOf(c.year, c.month, c.day))?.summary;
      return {
        Date: isoOf(c.year, c.month, c.day),
        Weekday: WEEKDAY_LABELS[c.weekday],
        Present: s?.present ?? "",
        Partial: s?.partial ?? "",
        "On leave": s?.leave ?? "",
        Absent: s?.absent ?? "",
        Counted: s?.counted ?? "",
        "Attendance %": s ? rateOf(s) : "",
      };
    });
  const csv = Papa.unparse(rows);
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `attendance-${MONTH_NAMES[month].toLowerCase()}-${year}.csv`,
  );
  toast.success("Month exported", { description: `${rows.length} working days` });
}

export function AttendanceCalendar({
  selected,
  onSelect,
  days,
  loading,
}: {
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
  days: Map<string, ApiDayResponse>;
  loading: boolean;
}) {
  const view = { year: selected.year, month: selected.month };
  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view.year, view.month]);

  const step = (dir: -1 | 1) => {
    let m = selected.month + dir;
    let y = selected.year;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    const lastDay = new Date(y, m + 1, 0).getDate();
    onSelect({ year: y, month: m, day: Math.min(selected.day, lastDay) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Previous month" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <CardTitle className="min-w-[10rem] text-center">
            {MONTH_NAMES[view.month]} {view.year}
          </CardTitle>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Next month" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </Button>
          {loading ? <span className="ml-2 text-xs text-muted-foreground">loading…</span> : null}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportMonthCsv(view.year, view.month, weeks, days)}>
          <Download className="size-4" /> Download
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {weeks.flat().map((cell, i) => (
            <DayCellView key={i} cell={cell} selected={selected} onSelect={onSelect} days={days} loading={loading} />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {[
              { label: "Present", dot: "bg-success" },
              { label: "On leave", dot: "bg-primary" },
              { label: "Absent / partial", dot: "bg-destructive" },
            ].map((m) => (
              <span key={m.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", m.dot)} />
                {m.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="wp-hatch size-2.5 rounded-full ring-1 ring-border" />
              Weekend / off
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Select a day to view its roster below ↓</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DayCellView({
  cell,
  selected,
  onSelect,
  days,
  loading,
}: {
  cell: DayCell;
  selected: AttendanceDate;
  onSelect: (d: AttendanceDate) => void;
  days: Map<string, ApiDayResponse>;
  loading: boolean;
}) {
  // Weekends and off-days: hatched, no data by design.
  if (!cell.isWorkday) {
    return (
      <div className={cn("wp-hatch flex min-h-[4.25rem] flex-col rounded-xl p-2", !cell.inMonth && "opacity-50")}>
        <span className={cn("text-xs font-semibold leading-none tabular-nums", cell.inMonth ? "text-muted-foreground" : "text-muted-foreground/50")}>
          {cell.day}
        </span>
      </div>
    );
  }

  const iso = isoOf(cell.year, cell.month, cell.day);
  const s = days.get(iso)?.summary; // guarded — undefined for future / today-open / failed fetch
  const isSelected =
    cell.inMonth && selected.year === cell.year && selected.month === cell.month && selected.day === cell.day;

  const base = cn(
    "flex min-h-[4.25rem] flex-col gap-1 rounded-xl bg-card p-2 text-left ring-1 ring-border transition-all",
    cell.isToday && !isSelected && "ring-primary/60",
    isSelected && "ring-2 ring-primary",
  );

  // No summary for a workday: either today (still open) or a day the cron hasn't closed / a skipped
  // fetch. Selectable, but shows a neutral placeholder rather than fabricated counts.
  if (!s) {
    return (
      <button
        type="button"
        onClick={() => onSelect({ year: cell.year, month: cell.month, day: cell.day })}
        className={cn(base, "hover:ring-primary/50")}
        title={`${cell.day}: ${cell.isToday ? "today — closes after midnight" : loading ? "loading" : "no record"}`}
      >
        <span className={cn("text-sm font-semibold leading-none tabular-nums", cell.isToday ? "text-primary" : "text-foreground")}>
          {cell.day}
        </span>
        <span className="mt-auto text-[11px] leading-none text-muted-foreground">
          {cell.isToday ? "open" : loading ? "…" : "—"}
        </span>
      </button>
    );
  }

  const rate = rateOf(s);
  const denom = s.counted || 1;
  const presentPct = (s.present / denom) * 100;
  const leavePct = (s.leave / denom) * 100;
  const offPct = Math.max(0, 100 - presentPct - leavePct); // absent + partial

  return (
    <button
      type="button"
      onClick={() => onSelect({ year: cell.year, month: cell.month, day: cell.day })}
      title={`${cell.day}: ${s.present} present · ${s.leave} on leave · ${s.absent} absent · ${s.partial} partial`}
      className={cn(base, "hover:shadow-sm hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn("text-sm font-semibold leading-none tabular-nums", cell.isToday ? "text-primary" : "text-foreground")}>
          {cell.day}
        </span>
        <span className={cn("text-[11px] font-semibold leading-none tabular-nums", rate >= 90 ? "text-success" : rate >= 75 ? "text-warning" : "text-destructive")}>
          {rate}%
        </span>
      </div>

      <div className="mt-auto space-y-1">
        <p className="text-[11px] leading-none text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{s.present}</span> present
        </p>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="bg-success" style={{ width: `${presentPct}%` }} />
          <span className="bg-primary" style={{ width: `${leavePct}%` }} />
          <span className="bg-destructive" style={{ width: `${offPct}%` }} />
        </div>
      </div>
    </button>
  );
}
