"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, Clock, CalendarOff, Plane } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import {
  MONTH_NAMES,
  TODAY,
  WEEKDAY_LABELS,
  monthMatrix,
  daysInMonth,
  dayRecordFor,
  isFutureDate,
  type DayStatus,
  type DayCell,
} from "@/lib/mock-attendance";
import { LogDatePicker } from "./attendance-log";
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

// Fixed axis for the "working window" timeline: 06:00 → 20:00 (in minutes).
const DAY_START = 6 * 60;
const DAY_END = 20 * 60;
const DAY_SPAN = DAY_END - DAY_START;

/** "HH:MM" → position (0–100%) along the day axis, clamped. */
function axisPct(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const mins = h * 60 + m;
  return Math.max(0, Math.min(100, ((mins - DAY_START) / DAY_SPAN) * 100));
}

export function PersonalAttendanceView() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  // The displayed month follows the selected date (mirrors the management
  // calendar), so the header date picker and chevrons share one source of truth.
  const [selected, setSelected] = useState({ ...TODAY });
  const view = { year: selected.year, month: selected.month };

  const weeks = useMemo(
    () => monthMatrix(view.year, view.month),
    [view.year, view.month],
  );

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

  // Prev/next move the selection by one month, clamping the day to the new
  // month's length; the grid follows because the view derives from the selection.
  const step = (dir: -1 | 1) =>
    setSelected((s) => {
      let m = s.month + dir;
      let y = s.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      const lastDay = daysInMonth(y, m);
      return { year: y, month: m, day: Math.min(s.day, lastDay) };
    });

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
          label="Hours tracked"
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
            <LogDatePicker value={selected} onChange={setSelected} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected({ ...TODAY })}
            >
              Today
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
      <Card className="gap-0 p-0 [--card-spacing:0px]">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <CalendarOff className="size-4 text-muted-foreground" />
          <h2 className="font-display text-base font-semibold tracking-tight">
            Recent days
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="whitespace-nowrap px-5 py-2.5 font-medium">
                  Date
                </th>
                <th scope="col" className="whitespace-nowrap px-5 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="w-full px-3 py-2.5 font-medium">
                  Working window
                </th>
                <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-medium">
                  Clock in
                </th>
                <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-medium">
                  Clock out
                </th>
                <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-medium">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.map((r) => {
                const meta = STATUS[r.status];
                const logged = r.hours > 0 && r.clockIn && r.clockOut;
                const left = logged ? axisPct(r.clockIn) : 0;
                const right = logged ? axisPct(r.clockOut) : 0;
                return (
                  <tr key={r.key} className="transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">
                      {r.label}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", meta.dot)} />
                        <span className="text-muted-foreground">{meta.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="relative h-1.5 w-full min-w-[7rem] overflow-hidden rounded-full bg-muted">
                        {logged ? (
                          <div
                            className={cn(
                              "absolute inset-y-0 rounded-full",
                              meta.dot,
                            )}
                            style={{
                              left: `${left}%`,
                              width: `${Math.max(right - left, 2)}%`,
                            }}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {logged ? r.clockIn : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {logged ? r.clockOut : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      {logged ? (
                        <span className="font-medium">{r.hours.toFixed(1)}h</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
