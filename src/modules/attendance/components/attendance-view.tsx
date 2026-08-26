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
import { PartyPopper } from "lucide-react";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
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
import { PeopleAttentionCard } from "@/modules/insights/components/people-attention";

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

  /**
   * Range and date are two halves of one selection, so every transition must move both.
   *
   * `selectDay` already did. The range buttons were wired straight to `setRange`, so pressing
   * **Today** refetched the data — the hook reads `range` — while `date` stayed on whatever day was
   * last picked. The chart showed today; the date picker, the heading and the calendar highlight
   * (all driven by `date`) still showed the old day, with nothing to say which was current.
   */
  const changeRange = (r: AttendanceRange) => {
    if (r === "today") setDate({ ...TODAY });
    setRange(r);
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
  });
  const livePct = live.counts.total
    ? Math.round((live.counts.present / live.counts.total) * 100)
    : 0;

  // The calendar shows the selected date's month, fed by the real month fan-out.
  const month = useMonthAttendance(date.year, date.month);

  // Org holidays, to flag when the day being inspected is a non-working holiday.
  const holidays = useOrgHolidays();

  // Publish the active filter + the counts on screen. Attendance is date-scoped, so without the
  // selected day the assistant answers about today no matter what the user is looking at.
  const iso = `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  useAssistantPageContext({
    date: range === "day" || range === "today" ? iso : null,
    facts: [
      { label: "Range", value: range === "custom" ? `${start} to ${end}` : range },
      ...(dept !== "all" ? [{ label: "Department filter", value: dept }] : []),
      { label: "Present", value: String(data.counts.present) },
      { label: "On leave", value: String(data.counts.leave) },
      { label: "Team size", value: String(data.counts.total) },
    ],
  });

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={
          live.loading
            ? "Today · presence loading…"
            : `Today · ${livePct}% of the team clocked in`
        }
      />

      {/* Org-side counterpart of PersonalAttendanceView's `att:summary`. Wrapped in a div rather
          than given the attribute directly: AttendanceOverview doesn't spread rest props, so a
          `data-tour` on it would never reach the DOM. */}
      <div data-tour="att:summary">
        <AttendanceOverview
          range={range}
          onRangeChange={changeRange}
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

      {/* Who needs following up on, straight after the day's numbers and before the roster detail.
          It used to sit on the AI-reports tab, which is where you go to *read* about the org rather
          than act on it — absences and short days are an attendance job, and this is the attendance
          page. Given the page's own `iso`, so it renders no second date control: the card is always
          describing the day the rest of the page is showing. */}
      <PeopleAttentionCard date={iso} />

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

      {/* When the inspected day is an org holiday, say so above the roster — the backend marks the
          day non-working, and this labels *why* attendance reads the way it does that day. */}
      {(range === "day" || range === "today") && holidays.isHoliday(iso) ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <PartyPopper className="size-4 shrink-0 text-primary" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Holiday:</span>{" "}
            {holidays.nameFor(iso)} — a non-working day for the organization.
          </span>
        </div>
      ) : null}

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
