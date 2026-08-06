"use client";

/**
 * Attendance — the top-level dispatcher.
 *
 *  - **Self-scoped roles (Employee)** see only their own attendance (`PersonalAttendanceView`, real
 *    `GET /v1/me/attendance`), unchanged.
 *  - **Everyone else** gets the redesigned org oversight page: a live "who's clocked in" header, an
 *    at-a-glance **overview** card (rate + range toggle + department filter + distribution graph), the
 *    month **calendar**, and a per-employee **log** table. Every number is real — today's presence
 *    from the device fleet (`GET /v1/fleet`), past days from the attendance close cron
 *    (`GET /v1/attendance/day`). See `use-oversight-attendance` for how each range maps to a call.
 */
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { TODAY } from "../lib/calendar";
import { useMonthAttendance } from "../use-month-attendance";
import {
  useOversightAttendance,
  type AttendanceDate,
  type AttendanceRange,
} from "../use-oversight-attendance";
import { PersonalAttendanceView } from "./personal-attendance-view";
import { AttendanceOverview } from "./attendance-overview";
import { AttendanceCalendar } from "./attendance-calendar";
import { AttendanceLog } from "./attendance-log";

export function AttendanceView() {
  const selfScoped = useIsSelfScoped();
  if (selfScoped) return <PersonalAttendanceView />;
  return <OversightAttendance />;
}

function OversightAttendance() {
  // Shared filter: a Today/Week/Month/Custom range (or a specific "day") + a department.
  const [range, setRange] = useState<AttendanceRange>("today");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dept, setDept] = useState("all");
  // The selected day drives the "day" range and the calendar's month.
  const [date, setDate] = useState<AttendanceDate>({ ...TODAY });

  // Selecting a day (picker or calendar) shows that specific date.
  const selectDay = (d: AttendanceDate) => {
    setDate(d);
    setRange("day");
  };

  // The active filter's data (counts + roster).
  const data = useOversightAttendance({ range, dept, date, start, end });

  // A separate always-"today" read for the header — so the live headline stays live even while the
  // body shows a past range. `dept` is honoured so the headline tracks the department filter.
  const live = useOversightAttendance({
    range: "today",
    dept,
    date,
    start: "",
    end: "",
    // The header only needs the live count — skip the trailing-average fetch the body's delta uses.
    benchmark: false,
  });
  const livePct = live.counts.total
    ? Math.round((live.counts.present / live.counts.total) * 100)
    : 0;

  // The calendar shows the selected date's month, fed by the real month fan-out.
  const month = useMonthAttendance(date.year, date.month);

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={
          live.loading
            ? "Today · live presence loading…"
            : `Today · ${livePct}% of the team clocked in`
        }
      />

      {/* Org-side counterpart of PersonalAttendanceView's `att:summary`. Wrapped in a div rather
          than given the attribute directly: AttendanceOverview doesn't spread rest props, so a
          `data-tour` on it would never reach the DOM. */}
      <div data-tour="att:summary">
        <AttendanceOverview
          range={range}
          onRangeChange={setRange}
          date={date}
          onDateChange={selectDay}
          start={start}
          end={end}
          onStartChange={setStart}
          onEndChange={setEnd}
          dept={dept}
          onDeptChange={setDept}
          departments={data.departments}
          counts={data.counts}
          series={data.series}
          benchmarkRate={data.benchmarkRate}
          label={data.label}
          loading={data.loading}
          note={data.note}
        />
      </div>

      {month.error ? (
        <div className="border-destructive/30 bg-destructive/5 flex items-center justify-between rounded-lg border px-4 py-2 text-sm">
          <span className="text-muted-foreground">{month.error}</span>
          <Button variant="outline" size="sm" onClick={month.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      <AttendanceCalendar
        selected={date}
        onSelect={selectDay}
        days={month.days}
        loading={month.loading}
      />

      <AttendanceLog
        rows={data.rows}
        mode={data.mode}
        loading={data.loading}
        error={data.error}
        label={data.label}
        note={data.note}
      />
    </div>
  );
}
