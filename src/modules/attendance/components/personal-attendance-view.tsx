"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarCheck, Clock, CalendarOff, Download, Plane } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/download";
import { useAuthStore } from "@/stores/auth.store";
import {
  MONTH_NAMES,
  REFERENCE_MONTH,
  TODAY,
  WEEKDAY_LABELS,
  monthMatrix,
  dayRecordFor,
  isFutureDate,
  type DayStatus,
  type DayCell,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

const STATUS: Record<
  DayStatus,
  { label: string; tile: string; dot: string }
> = {
  present: { label: "Present", tile: "bg-success/15 ring-success/30", dot: "bg-success" },
  late: { label: "Late", tile: "bg-warning/15 ring-warning/40", dot: "bg-warning" },
  leave: { label: "On leave", tile: "bg-primary/12 ring-primary/30", dot: "bg-primary" },
  absent: { label: "Absent", tile: "bg-destructive/12 ring-destructive/30", dot: "bg-destructive" },
};

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Export the current user's working days for the viewed month as CSV. */
function exportPersonalCsv(
  year: number,
  month: number,
  weeks: DayCell[][],
  userId: string,
) {
  const days = weeks.flat().filter((c) => c.month === month && c.isWorkday);
  const data = days.map((c) => {
    const rec = dayRecordFor(userId, c.year, c.month, c.day);
    return [
      `${c.year}-${pad2(c.month + 1)}-${pad2(c.day)}`,
      WEEKDAY_LABELS[c.weekday],
      STATUS[rec.status].label,
      rec.clockIn || "—",
      rec.clockOut || "—",
      rec.hours,
    ];
  });
  const csv = Papa.unparse({
    fields: ["Date", "Weekday", "Status", "Clock in", "Clock out", "Hours"],
    data,
  });
  const file = `my-attendance-${MONTH_NAMES[month].toLowerCase()}-${year}.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), file);
  toast.success("Attendance exported", {
    description: `${file} · ${days.length} working days`,
  });
}

export function PersonalAttendanceView() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  const [view, setView] = useState({
    year: REFERENCE_MONTH.year,
    month: REFERENCE_MONTH.month,
  });

  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view]);

  // The current user's own tally for the viewed month (elapsed workdays only).
  const summary = useMemo(() => {
    const acc = { present: 0, late: 0, leave: 0, absent: 0, hours: 0, workdays: 0 };
    for (const cell of weeks.flat()) {
      if (!cell.isWorkday) continue;
      if (isFutureDate(cell.year, cell.month, cell.day)) continue;
      const rec = dayRecordFor(userId, cell.year, cell.month, cell.day);
      acc[rec.status] += 1;
      acc.hours += rec.hours;
      acc.workdays += 1;
    }
    acc.hours = Math.round(acc.hours * 10) / 10;
    return acc;
  }, [weeks, userId]);

  const rate = summary.workdays
    ? Math.round(((summary.present + summary.late) / summary.workdays) * 100)
    : 0;

  // The user's own recent working days (most recent first).
  const recent = useMemo(() => {
    const out: { key: string; label: string; status: DayStatus; clockIn: string; clockOut: string; hours: number }[] = [];
    const cursor = new Date(TODAY.year, TODAY.month, TODAY.day);
    while (out.length < 10) {
      const wd = cursor.getDay();
      if (wd !== 0 && wd !== 6) {
        const rec = dayRecordFor(userId, cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
        out.push({
          key: cursor.toISOString().slice(0, 10),
          label: `${SHORT_DAY[wd]} ${MONTH_NAMES[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}`,
          status: rec.status,
          clockIn: rec.clockIn,
          clockOut: rec.clockOut,
          hours: rec.hours,
        });
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return out;
  }, [userId]);

  const step = (dir: -1 | 1) =>
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });

  // Selectable years — a range around today, always including the current view.
  const years = useMemo(() => {
    const set = new Set<number>();
    for (let y = TODAY.year - 5; y <= TODAY.year + 1; y++) set.add(y);
    set.add(view.year);
    return [...set].sort((a, b) => a - b);
  }, [view.year]);

  const goToToday = () =>
    setView({ year: REFERENCE_MONTH.year, month: REFERENCE_MONTH.month });

  if (!user) return null;

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="My attendance"
        description="Your own clock-ins, hours, and time off — only you can see this."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance rate"
          value={`${rate}%`}
          icon={CalendarCheck}
          hint={`${MONTH_NAMES[view.month]} ${view.year}`}
          featured
        />
        <StatCard
          label="Days present"
          value={`${summary.present + summary.late}/${summary.workdays}`}
          icon={CalendarCheck}
          hint={`${summary.late} late`}
        />
        <StatCard
          label="Hours logged"
          value={summary.hours.toFixed(1)}
          icon={Clock}
          hint="this month"
        />
        <StatCard
          label="Time off"
          value={summary.leave + summary.absent}
          icon={Plane}
          hint={`${summary.leave} leave · ${summary.absent} absent`}
        />
      </div>

      {/* Personal calendar */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Previous month"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <CardTitle>
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
            <Select
              value={String(view.month)}
              onValueChange={(v) => setView((s) => ({ ...s, month: Number(v) }))}
            >
              <SelectTrigger className="h-8 w-[8.5rem]" aria-label="Month">
                <SelectValue>
                  {(v) => (v == null ? "" : MONTH_NAMES[Number(v)])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(view.year)}
              onValueChange={(v) => setView((s) => ({ ...s, year: Number(v) }))}
            >
              <SelectTrigger className="h-8 w-[5.5rem]" aria-label="Year">
                <SelectValue>{(v) => (v == null ? "" : String(v))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportPersonalCsv(view.year, view.month, weeks, userId)}
            >
              <Download className="size-4" /> Download
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
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

          <div className="grid grid-cols-7 gap-1.5">
            {weeks.flat().map((cell, i) => (
              <PersonalDayCell key={i} cell={cell} userId={userId} />
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {(Object.keys(STATUS) as DayStatus[]).map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span className={cn("size-2.5 rounded-full", STATUS[s].dot)} />
                {STATUS[s].label}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="wp-hatch size-2.5 rounded-full ring-1 ring-border" />
              Weekend / off
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Personal recent log */}
      <Card className="gap-0 p-0">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <CalendarOff className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold tracking-tight">
            Recent days
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {recent.map((r) => {
            const meta = STATUS[r.status];
            return (
              <li key={r.key} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-28 shrink-0 font-medium">{r.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", meta.dot)} />
                  <span className="text-muted-foreground">{meta.label}</span>
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {r.clockIn} – {r.clockOut}
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums">
                  {r.hours > 0 ? `${r.hours.toFixed(1)}h` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function PersonalDayCell({ cell, userId }: { cell: DayCell; userId: string }) {
  if (!cell.isWorkday) {
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-[3.5rem] flex-col rounded-xl p-2",
          !cell.inMonth && "opacity-50",
        )}
      >
        <span className="text-xs font-semibold leading-none tabular-nums text-muted-foreground/70">
          {cell.day}
        </span>
      </div>
    );
  }

  const future = isFutureDate(cell.year, cell.month, cell.day);
  const rec = future ? null : dayRecordFor(userId, cell.year, cell.month, cell.day);
  const meta = rec ? STATUS[rec.status] : null;

  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] flex-col justify-between rounded-xl p-2 ring-1 transition-colors",
        meta ? `${meta.tile} ring-inset` : "bg-card ring-border",
        cell.isToday && "ring-2 ring-primary",
      )}
      title={rec ? `${cell.day}: ${meta!.label} · ${rec.hours.toFixed(1)}h` : `${cell.day}`}
    >
      <span
        className={cn(
          "text-sm font-semibold leading-none tabular-nums",
          cell.isToday ? "text-primary" : "text-foreground",
        )}
      >
        {cell.day}
      </span>
      {rec ? (
        <span className="text-right text-[11px] font-medium tabular-nums text-foreground/70">
          {rec.hours > 0 ? `${rec.hours.toFixed(1)}h` : meta!.label}
        </span>
      ) : null}
    </div>
  );
}
