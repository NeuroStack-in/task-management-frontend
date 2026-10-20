"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, CalendarX2, Clock, CalendarOff, Plane } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useAssistantPageContext } from "@/stores/page-context.store";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  monthMatrix,
  daysInMonth,
  isFutureDate,
  isCounted,
  today,
  type CalendarDay,
  type DayStatus,
  type DayCell,
} from "../lib/calendar";
import { attendanceRate } from "../lib/attended";
import { useToday } from "../use-today";
import { LogDatePicker } from "./attendance-log";
import { useWorkdays, useWorkingHours } from "@/hooks/use-working-hours";
import { useMyStartDate } from "@/hooks/use-org-start";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { HolidayBadge } from "@/components/shared/holiday-badge";
import { isWorkday } from "@/lib/workdays";
import {
  useMyAttendance,
  ymd,
  type MyAttendanceRange,
} from "../use-my-attendance";
import { formatDate, formatHours, formatMinutes } from "@/lib/format";
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
  // An admin excused the day — not an absence, and not counted (WP-257).
  excused: { label: "Excused", tile: "bg-muted/60 ring-border", dot: "bg-muted-foreground/60" },
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

/** The 24-day window back from `now` that feeds the "recent days" list, as YYYY-MM-DD. */
function recentFrom(now: CalendarDay): string {
  const d = new Date(now.year, now.month, now.day);
  d.setDate(d.getDate() - 24);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function PersonalAttendanceView() {
  const user = useAuthStore((s) => s.user);
  // The real today, re-read at midnight. A module constant kept the load day, so a tab open since
  // Monday treated Tuesday's closed record as the future on Wednesday (QA audit 2026-10-08, WP-258).
  const now = useToday();

  // The displayed month follows the selected date (mirrors the management
  // calendar), so the header date picker and chevrons share one source of truth.
  const [selected, setSelected] = useState<CalendarDay>(today);
  const view = { year: selected.year, month: selected.month };

  const workdays = useWorkdays();
  const holidays = useOrgHolidays();
  // Days before this person joined have no attendance to report — block them out (hatched, like a
  // weekend) rather than leaving an empty workday that reads as a day they failed to turn up for.
  // Their own join date, not the org's: someone who started in August was not absent in March.
  const myStart = useMyStartDate();
  // The expected working day the day-completion bar fills toward (the org's declared hours).
  const expectedMin = expectedDayMinutes(useWorkingHours());
  const weeks = useMemo(
    () => monthMatrix(view.year, view.month, workdays, now),
    [view.year, view.month, workdays, now],
  );

  // Two range reads from the real backend (GET /v1/me/attendance):
  //  - the viewed month, for the calendar grid and the monthly summary;
  //  - a fixed 24-day window back from today, for the "recent days" list (which is relative to
  //    today, not the viewed month, so it must not move when you page months).
  const monthData = useMyAttendance(
    ymd(view.year, view.month, 1),
    ymd(view.year, view.month, daysInMonth(view.year, view.month)),
  );
  const recentData = useMyAttendance(recentFrom(now), ymd(now.year, now.month, now.day));

  // The current user's own tally for the viewed month (elapsed, counted days only).
  const summary = useMemo(() => {
    const acc = {
      present: 0,
      partial: 0,
      leave: 0,
      absent: 0,
      non_workday: 0,
      /** Excused by an admin — counted in nothing, kept only so the legend can mention it. */
      excused: 0,
      /** Subset of `present` — never add the two. */
      late: 0,
      hours: 0,
      workdays: 0,
    };
    for (const cell of weeks.flat()) {
      if (!cell.inMonth) continue;
      if (isFutureDate(cell.year, cell.month, cell.day, now)) continue;
      // Blocked-out days are outside the expected set, exactly like a weekend — counting them would
      // put days the person had not joined for into the denominator and drag the month's rate down.
      if (myStart !== null && ymd(cell.year, cell.month, cell.day) < myStart) continue;
      // Real data now: `null` = the close cron hasn't resolved this day yet. An unresolved workday
      // is genuinely unknown, so it counts toward nothing until the cron stamps it.
      const rec = monthData.recordFor(cell.year, cell.month, cell.day);
      if (!rec) continue;
      if (rec.status === "excused") acc.excused += 1;
      // The record decides, not the schedule. A day off nobody worked closes as `non_workday` and
      // `isCounted` drops it (LLD §7); a day off that was worked closes as `present` and counts —
      // filtering by the schedule first made that day and its hours vanish (QA audit 2026-10-08,
      // WP-260).
      if (!isCounted(rec.status)) continue;
      acc[rec.status] += 1;
      if (rec.late) acc.late += 1;
      // Exact hours (`worked_minutes / 60`) — summed, then formatted once (WP-261).
      acc.hours += rec.hours;
      acc.workdays += 1;
    }
    return acc;
  }, [weeks, monthData, myStart, now]);
  // The tiles show "—" until this month's records are in — and after a failed read — rather than
  // zeros that look exactly like a real empty month (QA audit 2026-10-08, WP-483).
  const ready = monthData.loaded;
  const tileHint = monthData.error ? "Not available" : "Loading…";

  // One definition of "attended" for every surface (`lib/attended`): present + partial over the
  // counted days. This used to be `present / workdays`, which silently dropped partial days from the
  // numerator while keeping them in the denominator — so an employee with partial days saw a LOWER
  // rate on their own page than their manager saw for the same month on the roster. That divergence
  // is the exact thing `lib/attended` was written to end (it records a day reading 38% on one
  // surface and 31% on another), so this reads the shared helper rather than restating it.
  // `late` is deliberately absent: it already sits inside `present`.
  const rate = attendanceRate(summary, summary.workdays);

  // Publish the viewer's own attendance summary (for the month on screen) to the assistant, plus the
  // selected day so a date-scoped question lands on the day the user is looking at.
  useAssistantPageContext({
    date: ymd(selected.year, selected.month, selected.day),
    facts: [
      {
        label: "Viewing month",
        value: `${view.year}-${String(view.month + 1).padStart(2, "0")}`,
      },
      ...(ready
        ? [
            { label: "Attendance rate (month)", value: summary.workdays > 0 ? `${rate}%` : "no closed days yet" },
            { label: "Present days", value: String(summary.present) },
            { label: "Absent", value: String(summary.absent) },
            { label: "On leave", value: String(summary.leave) },
            { label: "Late arrivals", value: String(summary.late) },
            { label: "Hours (month)", value: formatHours(summary.hours) },
          ]
        : [{ label: "Attendance (month)", value: monthData.error ? "couldn't be loaded" : "loading" }]),
    ],
  });

  // The user's own recent working days (most recent first) — only days the cron has resolved. Walks
  // back across the fetched window and takes up to 10 resolved workdays; an unclosed day is skipped
  // rather than shown blank, and the walk is bounded so it can't run past the fetched range.
  const recent = useMemo(() => {
    const out: { key: string; iso: string; status: DayStatus; late: boolean; clockIn: string; clockOut: string; hours: number; holiday: string | undefined }[] = [];
    const cursor = new Date(now.year, now.month, now.day);
    let guard = 0;
    while (out.length < 10 && guard < 40) {
      guard += 1;
      const rec = recentData.recordFor(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
      );
      // The org's scheduled days — never a hardcoded Mon–Fri: a 7-day org shows Sat and Sun here, a
      // Sun–Thu org shows those. Plus any day off that was worked: it closes as a counted day, and
      // skipping it hid that work from the list (WP-260).
      if (rec && (isWorkday(cursor, workdays) || isCounted(rec.status))) {
        out.push({
          key: `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`,
          // Labelled with the shared date notation at render (UX audit 2026-10-16, TIME-14 / XC-06).
          iso: ymd(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
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
      cursor.setDate(cursor.getDate() - 1);
    }
    return out;
  }, [recentData, workdays, holidays, now]);

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
    // No bottom padding of its own: the shell reserves the assistant button's room (XC-03).
    <div className="space-y-5 pt-1">
      <PageHeader
        title="My attendance"
        // Not "only you can see this": managers and admins read the same records and can export them
        // (UX audit 2026-10-16, TIME-03).
        description="Your own attendance and time off, computed from your synced activity. Your manager and admins can see it too."
        actions={
          <RefreshButton
            onRefresh={() => {
              monthData.reload();
              recentData.reload();
            }}
            refreshing={monthData.loading || recentData.loading}
          />
        }
      />

      {monthData.error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{monthData.error}</span>
          <Button variant="outline" size="sm" onClick={monthData.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* `att:summary` is marked in BOTH branches of /attendance — here and in the org view.
          Five tiles: leave and absences are separate facts and get one each (TIME-13). */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        data-tour="att:summary"
      >
        <StatCard
          label="Attendance rate"
          // No closed day yet (the 1st of the month) is no rate, not 0 %.
          value={ready && summary.workdays > 0 ? `${rate}%` : "—"}
          icon={CalendarCheck}
          hint={`${MONTH_NAMES[view.month]} ${view.year}`}
          featured
        />
        <StatCard
          label="Days present"
          // `present` ALREADY includes late arrivals — the server sends a late day as
          // `status: "present"` with `late: true`, and the summary loop counts it in both buckets,
          // so `late` is a SUBSET of `present`, never a sibling. Adding them double-counted every
          // late day and could print more present days than the month has workdays ("25/20"). The
          // rate below was corrected for exactly this; this card was missed. `late` stays as the
          // hint, which is what it is: a qualifier on some of these days, not extra days.
          value={ready ? `${summary.present}/${summary.workdays}` : "—"}
          icon={CalendarCheck}
          hint={ready ? `${summary.late} late` : tileHint}
        />
        <StatCard
          label="Hours tracked"
          // The product's one duration notation, from the exact minute total (WP-261).
          value={ready ? formatHours(summary.hours) : "—"}
          icon={Clock}
          hint={ready ? "this month" : tileHint}
        />
        {/* Leave is leave and an absence is an absence (UX audit 2026-10-16, TIME-13). One "Time
            off" tile under a plane icon added the two together, so two unexplained absences read
            as "Time off 2" — as if they were approved holidays. */}
        <StatCard
          label="Leave taken"
          value={ready ? summary.leave : "—"}
          icon={Plane}
          hint={ready ? `approved day${summary.leave === 1 ? "" : "s"} off` : tileHint}
        />
        <StatCard
          label="Absences"
          value={ready ? summary.absent : "—"}
          icon={CalendarX2}
          // What `absent` is, server-side: a scheduled workday with no tracked time and no leave.
          hint={ready ? "workdays with no time or leave" : tileHint}
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
              onClick={() => setSelected({ ...now })}
            >
              Today
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Each cell names its own weekday for a screen reader (TIME-15), so this row is visual. */}
          <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
            {WEEKDAY_LABELS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 gap-1.5"
            role="group"
            aria-label={`${MONTH_NAMES[view.month]} ${view.year}, day by day`}
          >
            {weeks.flat().map((cell, i) => (
              <PersonalDayCell
                key={i}
                cell={cell}
                now={now}
                recordFor={monthData.recordFor}
                beforeStart={
                  myStart !== null && ymd(cell.year, cell.month, cell.day) < myStart
                }
                holidayName={
                  cell.inMonth ? holidays.nameFor(ymd(cell.year, cell.month, cell.day)) : undefined
                }
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            {/* "Excused" only exists in managed-agent orgs; it joins the legend when the month has one. */}
            {(Object.keys(STATUS) as DayStatus[])
              .filter((s) => s !== "excused" || summary.excused > 0)
              .map((s) => (
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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarOff className="size-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold tracking-tight">
              Recent days
            </h2>
          </div>
          {/* What the bar means, said once and visibly — it was a "Hours worked" percentage beside a
              separate Hours column, the same figure twice, explained only in a tooltip (TIME-18). */}
          <p className="text-xs text-muted-foreground">
            Bars show each day against your organization&apos;s {formatMinutes(expectedMin)}{" "}
            working day.
          </p>
        </div>
        {/* Loading and empty are states of their own (UX audit 2026-10-16, TIME-18): the list used
            to render nothing at all until the read landed, and nothing at all when it was empty. */}
        {!recentData.loaded && !recentData.error ? (
          <div className="space-y-2 p-5" aria-busy="true" aria-label="Loading recent days">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : recentData.error && !recentData.loaded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm">
            <span className="text-muted-foreground">
              Your recent days couldn&apos;t be loaded. {recentData.error}
            </span>
            <Button variant="outline" size="sm" onClick={recentData.reload}>
              Retry
            </Button>
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="No closed days yet"
            description="Each workday appears here after the nightly close settles it — today shows up tomorrow."
            className="m-4 border-0"
          />
        ) : (
          <>
            {/* Phones: one card per day. Clock in/out and Hours were past the right edge of a 390 px
                screen behind an unlabelled sideways scroll (UX audit 2026-10-16, TIME-12 / XC-05). */}
            <ul className="divide-y divide-border sm:hidden" aria-label="Recent days">
              {recent.map((r) => {
                const logged = r.hours > 0 && r.clockIn && r.clockOut;
                return (
                  <li key={r.key} className="space-y-2 px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        {formatDate(r.iso, { weekday: true, year: false })}
                        {r.holiday ? <HolidayBadge name={r.holiday} /> : null}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm">
                        <span className={cn("size-2 rounded-full", dayStatusDot(r.status, r.late))} />
                        <span className={cn("font-medium", dayStatusTextColor(r.status, r.late))}>
                          {dayStatusLabel(r.status, r.late)}
                        </span>
                      </span>
                    </div>
                    <HoursWorked hours={r.hours} status={r.status} expectedMin={expectedMin} />
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Clock in</dt>
                        <dd className="font-medium tabular-nums">{logged ? r.clockIn : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Clock out</dt>
                        <dd className="font-medium tabular-nums">{logged ? r.clockOut : "—"}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
            <div
              className="hidden overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring sm:block"
              role="region"
              aria-label="Recent days"
              tabIndex={0}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="whitespace-nowrap px-5 py-2.5 font-medium">
                      Date
                    </th>
                    <th scope="col" className="whitespace-nowrap px-5 py-2.5 font-medium">
                      Status
                    </th>
                    {/* One column for the day's hours — the figure, with the bar beside it. */}
                    <th scope="col" className="w-full px-3 py-2.5 font-medium">
                      Hours worked
                    </th>
                    <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-medium">
                      Clock in
                    </th>
                    <th scope="col" className="whitespace-nowrap px-5 py-2.5 text-right font-medium">
                      Clock out
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recent.map((r) => {
                    // Clock columns still show times only when both punches exist.
                    const logged = r.hours > 0 && r.clockIn && r.clockOut;
                    return (
                      <tr key={r.key} className="transition-colors hover:bg-muted/40">
                        <td className="whitespace-nowrap px-5 py-3 font-medium">
                          <span className="flex items-center gap-2">
                            {formatDate(r.iso, { weekday: true, year: false })}
                            {r.holiday ? <HolidayBadge name={r.holiday} /> : null}
                          </span>
                        </td>
                        {/* Status reflects the *resolved* verdict, including the late qualifier: a
                            present-but-late day reads "Late", a short day "Partial", etc. — never a
                            flat "Present" for everything. */}
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={cn("size-2 rounded-full", dayStatusDot(r.status, r.late))} />
                            <span className={cn("font-medium", dayStatusTextColor(r.status, r.late))}>
                              {dayStatusLabel(r.status, r.late)}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <HoursWorked hours={r.hours} status={r.status} expectedMin={expectedMin} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {logged ? r.clockIn : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {logged ? r.clockOut : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * A day's hours worked: the `HH:MM:SS` figure, with a bar filling toward the org's expected day.
 *
 * One figure, not two (UX audit 2026-10-16, TIME-18). The row used to carry a percentage bar under
 * "Hours worked" *and* a separate "Hours" column — the same amount said twice, the percentage
 * explained only in a hover tooltip. The bar stays because "short day" is easiest to see as a short
 * bar; its meaning is in the card header, and its share is in the accessible name.
 *
 * Hours come from attendance (`worked_minutes`) and exist without clock punches, so this is gated on
 * hours, never on the punches. Coloured by status (green present / amber partial), matching the same
 * threshold that decides present vs partial.
 */
function HoursWorked({
  hours,
  status,
  expectedMin,
}: {
  hours: number;
  status: string;
  expectedMin: number;
}) {
  if (hours <= 0) return <span className="text-muted-foreground">—</span>;
  const fillPct = Math.min(100, ((hours * 60) / expectedMin) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative h-1.5 w-full min-w-[5rem] overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${Math.round(fillPct)}% of a ${formatMinutes(expectedMin)} day`}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", statusMeta(status).dot)}
          style={{ width: `${Math.max(fillPct, 2)}%` }}
        />
      </div>
      <span className="shrink-0 text-right font-medium tabular-nums">{formatHours(hours)}</span>
    </div>
  );
}

function PersonalDayCell({
  cell,
  now,
  recordFor,
  holidayName,
  beforeStart = false,
}: {
  cell: DayCell;
  /** The real today (`useToday`), so a day is "future" against the clock, not the load day. */
  now: CalendarDay;
  recordFor: MyAttendanceRange["recordFor"];
  holidayName?: string;
  /** Before this person joined: hatched and unlabelled, like a weekend. */
  beforeStart?: boolean;
}) {
  const future = isFutureDate(cell.year, cell.month, cell.day, now);
  const rec =
    future || beforeStart || !cell.inMonth ? null : recordFor(cell.year, cell.month, cell.day);
  // A day off is hatched unless it was worked: then it closed as a counted day (`present`), and the
  // hatch hid that work and its hours (QA audit 2026-10-08, WP-260).
  const workedOff = !cell.isWorkday && rec !== null && isCounted(rec.status);
  // The cell's whole story as one sentence, for a screen reader (UX audit 2026-10-16, TIME-15). It
  // used to live only in a `title` tooltip, which neither a keyboard nor a screen reader reaches —
  // the cell announced a bare "14". The visible pieces are hidden from assistive tech instead, so
  // the date is not read twice. The same sentence stays as the hover tooltip.
  const dateText = formatDate(ymd(cell.year, cell.month, cell.day), { weekday: true });
  const holidayText = holidayName ? `Holiday: ${holidayName}` : "";

  if ((!cell.isWorkday && !workedOff) || beforeStart) {
    const story = [
      dateText,
      beforeStart ? "before you joined" : holidayText || "day off",
    ].join(": ");
    return (
      <div
        className={cn(
          "wp-hatch flex min-h-[3.5rem] flex-col gap-1 rounded-xl p-2",
          !cell.inMonth && "opacity-50",
        )}
        title={story}
        // A neighbouring month's day is context for the eye only.
        aria-hidden={!cell.inMonth || undefined}
      >
        <span className="sr-only">{story}</span>
        <span
          aria-hidden="true"
          className="text-xs font-semibold leading-none tabular-nums text-muted-foreground"
        >
          {cell.day}
        </span>
        {!beforeStart && holidayName ? (
          <span aria-hidden="true" className="mt-auto self-start">
            <HolidayBadge name={holidayName} showIcon={false} className="px-1" />
          </span>
        ) : null}
      </div>
    );
  }

  const meta = rec ? statusMeta(rec.status) : null;
  const story = rec
    ? `${dateText}: ${dayStatusLabel(rec.status, rec.late)}${
        rec.hours > 0 ? `, ${formatHours(rec.hours)} worked` : ""
      }${holidayText ? ` · ${holidayText}` : ""}${workedOff ? " · worked on a day off" : ""}`
    : `${dateText}${cell.isToday ? ": today, closes tonight" : future ? "" : ": no record yet"}${
        holidayText ? ` · ${holidayText}` : ""
      }`;

  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] flex-col justify-between rounded-xl p-2 ring-1 transition-colors",
        meta ? `${meta.tile} ring-inset` : "bg-card ring-border",
        cell.isToday && "ring-2 ring-primary",
      )}
      title={story}
      aria-hidden={!cell.inMonth || undefined}
    >
      <span className="sr-only">{story}</span>
      <div aria-hidden="true" className="flex items-start justify-between gap-1">
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
        <div aria-hidden="true" className="flex items-end justify-between gap-1">
          <span
            className={cn(
              // `min-w-0 truncate`: the figure beside this is `shrink-0` and got wider when the
              // product settled on one duration notation (`6.8h` → `06:48:00`). In a narrow month
              // cell the status word is the half that should give, and it gives by truncating
              // rather than by pushing the hours out of the cell.
              "min-w-0 truncate text-[10px] font-medium leading-tight",
              dayStatusTextColor(rec.status, rec.late),
            )}
          >
            {dayStatusLabel(rec.status, rec.late)}
          </span>
          {/* Not on a phone: a 390 px month cell is ~44 px wide, and `03:10:00` spilled out of it
              over the next day. The day's hours are in Recent days below and in the cell's
              screen-reader sentence; the status word keeps the room. */}
          {rec.hours > 0 ? (
            <span className="hidden shrink-0 text-[11px] font-medium tabular-nums text-foreground/70 sm:inline">
              {formatHours(rec.hours)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
