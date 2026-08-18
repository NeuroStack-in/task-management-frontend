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
  isFutureDate,
  isCounted,
  type DayStatus,
  type DayCell,
} from "../lib/calendar";
import { LogDatePicker } from "./attendance-log";
import { useWorkdays, useWorkingHours } from "@/hooks/use-working-hours";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { HolidayBadge } from "@/components/shared/holiday-badge";
import { isWorkday } from "@/lib/workdays";
import {
  useMyAttendance,
  ymd,
  type MyAttendanceRange,
} from "../use-my-attendance";
import { cn } from "@/lib/utils";

const STATUS: Record<
  DayStatus,
  { label: string; tile: string; dot: string }
> = {
  present: { label: "Present", tile: "bg-success/15 ring-success/30", dot: "bg-success" },
  partial: { label: "Partial", tile: "bg-warning/15 ring-warning/40", dot: "bg-warning" },
  leave: { label: "On leave", tile: "bg-primary/12 ring-primary/30", dot: "bg-primary" },
  absent: { label: "Absent", tile: "bg-destructive/12 ring-destructive/30", dot: "bg-destructive" },
  non_workday: { label: "Non-working day", tile: "bg-muted/40 ring-border", dot: "bg-muted-foreground/40" },
};

/** Never index STATUS with a raw server value directly: a status the map doesn't have would be
 *  `undefined` and crash on `.tone`/`.dot`. This always returns a renderable meta. */
const statusMeta = (s: string) =>
  STATUS[s as DayStatus] ?? {
    label: s,
    tile: "bg-muted/40 ring-border",
    dot: "bg-muted-foreground/40",
  };

/** `late` qualifies `present` — styled as a marker on the tile, not a status of its own. */
const LATE_DOT = "bg-warning";

/**
 * The label shown for a resolved day. `late` is a qualifier on `present` (not its own status), so a
 * present-but-late day reads **"Late"** rather than "Present"; `non_workday` reads the shorter
 * "Day off". Shared by the calendar cells and the Recent-days status column so the two never drift.
 */
function dayStatusLabel(status: string, late: boolean): string {
  if (status === "present") return late ? "Late" : "Present";
  if (status === "non_workday") return "Day off";
  return statusMeta(status).label; // Partial / On leave / Absent (+ any unknown)
}

/** Text colour for that label — warning for a late present day, else the status's own colour. */
function dayStatusTextColor(status: string, late: boolean): string {
  if (status === "present" && late) return "text-warning";
  switch (status) {
    case "present":
      return "text-success";
    case "partial":
      return "text-warning";
    case "leave":
      return "text-primary";
    case "absent":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

/** Dot colour, late-aware — warning for a late present day, else the status dot. */
function dayStatusDot(status: string, late: boolean): string {
  return status === "present" && late ? LATE_DOT : statusMeta(status).dot;
}

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The org's expected working day, in minutes (declared span − unpaid break) — the denominator the
 * day-completion bar fills toward. Mirrors the score's expected day (PRODUCTIVITY.md §1.2). Falls
 * back to 8h when the settings read hasn't resolved, which is exactly what the server assumes for an
 * unconfigured org, so the bar reads sensibly before working-hours load.
 */
function expectedDayMinutes(
  h: { work_start: string; work_end: string; break_minutes: number } | null,
): number {
  if (!h) return 480;
  const toMin = (hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };
  const span = toMin(h.work_end) - toMin(h.work_start) - Math.max(0, h.break_minutes || 0);
  return span > 0 ? Math.max(60, span) : 480;
}

/** The 24-day window back from today that feeds the "recent days" list, as YYYY-MM-DD. */
function recentFrom(): string {
  const d = new Date(TODAY.year, TODAY.month, TODAY.day);
  d.setDate(d.getDate() - 24);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function PersonalAttendanceView() {
  const user = useAuthStore((s) => s.user);

  // The displayed month follows the selected date (mirrors the management
  // calendar), so the header date picker and chevrons share one source of truth.
  const [selected, setSelected] = useState({ ...TODAY });
  const view = { year: selected.year, month: selected.month };

  const workdays = useWorkdays();
  const holidays = useOrgHolidays();
  // The expected working day the day-completion bar fills toward (the org's declared hours).
  const expectedMin = expectedDayMinutes(useWorkingHours());
  const weeks = useMemo(
    () => monthMatrix(view.year, view.month, workdays),
    [view.year, view.month, workdays],
  );

  // Two range reads from the real backend (GET /v1/me/attendance):
  //  - the viewed month, for the calendar grid and the monthly summary;
  //  - a fixed 24-day window back from today, for the "recent days" list (which is relative to
  //    today, not the viewed month, so it must not move when you page months).
  const monthData = useMyAttendance(
    ymd(view.year, view.month, 1),
    ymd(view.year, view.month, daysInMonth(view.year, view.month)),
  );
  const recentData = useMyAttendance(recentFrom(), ymd(TODAY.year, TODAY.month, TODAY.day));

  // The current user's own tally for the viewed month (elapsed workdays only).
  const summary = useMemo(() => {
    const acc = {
      present: 0,
      partial: 0,
      leave: 0,
      absent: 0,
      non_workday: 0,
      /** Subset of `present` — never add the two. */
      late: 0,
      hours: 0,
      workdays: 0,
    };
    for (const cell of weeks.flat()) {
      if (!cell.isWorkday) continue;
      if (isFutureDate(cell.year, cell.month, cell.day)) continue;
      // Real data now: `null` = the close cron hasn't resolved this day yet. An unresolved workday
      // is genuinely unknown, so it counts toward nothing until the cron stamps it.
      const rec = monthData.recordFor(cell.year, cell.month, cell.day);
      if (!rec) continue;
      // A non-workday is excluded from the expected set, so it must not reach the
      // denominator — that's what `isCounted` is for (LLD §7).
      if (!isCounted(rec.status)) continue;
      acc[rec.status] += 1;
      if (rec.late) acc.late += 1;
      acc.hours += rec.hours;
      acc.workdays += 1;
    }
    acc.hours = Math.round(acc.hours * 10) / 10;
    return acc;
  }, [weeks, monthData]);

  // `present` already includes late arrivals — the old `present + late` double-counted them.
  const rate = summary.workdays
    ? Math.round((summary.present / summary.workdays) * 100)
    : 0;

  // The user's own recent working days (most recent first) — only days the cron has resolved. Walks
  // back across the fetched window and takes up to 10 resolved workdays; an unclosed day is skipped
  // rather than shown blank, and the walk is bounded so it can't run past the fetched range.
  const recent = useMemo(() => {
    const out: { key: string; label: string; status: DayStatus; late: boolean; clockIn: string; clockOut: string; hours: number; holiday: string | undefined }[] = [];
    const cursor = new Date(TODAY.year, TODAY.month, TODAY.day);
    let guard = 0;
    while (out.length < 10 && guard < 40) {
      guard += 1;
      const wd = cursor.getDay();
      // Include exactly the org's scheduled days — never a hardcoded Mon–Fri. A 7-day org shows Sat
      // and Sun here; a Sun–Thu org shows those. (This used to skip weekends unconditionally.)
      if (isWorkday(cursor, workdays)) {
        const rec = recentData.recordFor(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
        );
        if (rec) {
          out.push({
            key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
            label: `${SHORT_DAY[wd]} ${MONTH_NAMES[cursor.getMonth()].slice(0, 3)} ${cursor.getDate()}`,
            status: rec.status,
            late: rec.late,
            clockIn: rec.clockIn,
            clockOut: rec.clockOut,
            hours: rec.hours,
            holiday: holidays.nameFor(
              ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
            ),
          });
        }
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return out;
  }, [recentData, workdays, holidays]);

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
        description="Your own attendance and time off — computed from your synced activity, only you can see this."
      />

      {monthData.error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{monthData.error}</span>
          <Button variant="outline" size="sm" onClick={monthData.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* `att:summary` is marked in BOTH branches of /attendance — here and in the org view. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="att:summary">
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
              <PersonalDayCell
                key={i}
                cell={cell}
                recordFor={monthData.recordFor}
                holidayName={
                  cell.inMonth ? holidays.nameFor(ymd(cell.year, cell.month, cell.day)) : undefined
                }
              />
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
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full bg-primary/30 ring-1 ring-primary/40" />
              Holiday
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
                  Hours worked
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
                const meta = statusMeta(r.status);
                // Clock columns still show times only when both punches exist.
                const logged = r.hours > 0 && r.clockIn && r.clockOut;
                // Day-completion: hours worked as a share of the expected day, capped at 100%.
                const fillPct =
                  r.hours > 0 ? Math.min(100, ((r.hours * 60) / expectedMin) * 100) : 0;
                return (
                  <tr key={r.key} className="transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        {r.label}
                        {r.holiday ? <HolidayBadge name={r.holiday} /> : null}
                      </span>
                    </td>
                    {/* Status reflects the *resolved* verdict, including the late qualifier: a
                        present-but-late day reads "Late", a short day "Partial", etc. — never a flat
                        "Present" for everything. */}
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", dayStatusDot(r.status, r.late))} />
                        <span className={cn("font-medium", dayStatusTextColor(r.status, r.late))}>
                          {dayStatusLabel(r.status, r.late)}
                        </span>
                      </span>
                    </td>
                    {/* Day-completion bar: fills from the left toward the org's expected day, so a
                        short day reads as a short bar. Coloured by status (green present / amber
                        partial), matching the same threshold that decides present vs partial. */}
                    <td className="px-3 py-3">
                      <div
                        className="flex items-center gap-2"
                        title={
                          r.hours > 0
                            ? `${r.hours.toFixed(1)}h of a ${(expectedMin / 60).toFixed(1)}h day`
                            : undefined
                        }
                      >
                        <div className="relative h-1.5 w-full min-w-[7rem] overflow-hidden rounded-full bg-muted">
                          {r.hours > 0 ? (
                            <div
                              className={cn("absolute inset-y-0 left-0 rounded-full", meta.dot)}
                              style={{ width: `${Math.max(fillPct, 2)}%` }}
                            />
                          ) : null}
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {r.hours > 0 ? `${Math.round(fillPct)}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {logged ? r.clockIn : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {logged ? r.clockOut : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      {/* Hours come from attendance (worked_minutes) and exist without clock
                          punches — so this is gated on hours, not on `logged`. */}
                      {r.hours > 0 ? (
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

function PersonalDayCell({
  cell,
  recordFor,
  holidayName,
}: {
  cell: DayCell;
  recordFor: MyAttendanceRange["recordFor"];
  holidayName?: string;
}) {
  if (!cell.isWorkday) {
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-[3.5rem] flex-col gap-1 rounded-xl p-2",
          !cell.inMonth && "opacity-50",
        )}
        title={holidayName ? `Holiday: ${holidayName}` : undefined}
      >
        <span className="text-xs font-semibold leading-none tabular-nums text-muted-foreground/70">
          {cell.day}
        </span>
        {holidayName ? (
          <HolidayBadge name={holidayName} showIcon={false} className="mt-auto self-start px-1" />
        ) : null}
      </div>
    );
  }

  const future = isFutureDate(cell.year, cell.month, cell.day);
  const rec = future ? null : recordFor(cell.year, cell.month, cell.day);
  const meta = rec ? statusMeta(rec.status) : null;

  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] flex-col justify-between rounded-xl p-2 ring-1 transition-colors",
        meta ? `${meta.tile} ring-inset` : "bg-card ring-border",
        cell.isToday && "ring-2 ring-primary",
      )}
      title={
        rec
          ? `${cell.day}: ${meta!.label}${rec.late ? " (late)" : ""} · ${rec.hours.toFixed(1)}h${holidayName ? ` · Holiday: ${holidayName}` : ""}`
          : holidayName
            ? `${cell.day} · Holiday: ${holidayName}`
            : `${cell.day}`
      }
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={cn(
            "text-sm font-semibold leading-none tabular-nums",
            cell.isToday ? "text-primary" : "text-foreground",
          )}
        >
          {cell.day}
        </span>
        {holidayName ? <HolidayBadge name={holidayName} showIcon={false} className="px-1" /> : null}
      </div>
      {/* Mention the resolved attendance on every cell: the status word (Present / Late / Partial /
          Absent / Day off — `late` qualifies present per LLD §7) plus the hours when any were worked.
          Before this a present/partial day showed only its hours, indistinguishable from each other. */}
      {rec ? (
        <div className="flex items-end justify-between gap-1">
          <span
            className={cn(
              "text-[10px] font-medium leading-tight",
              dayStatusTextColor(rec.status, rec.late),
            )}
          >
            {dayStatusLabel(rec.status, rec.late)}
          </span>
          {rec.hours > 0 ? (
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground/70">
              {rec.hours.toFixed(1)}h
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
