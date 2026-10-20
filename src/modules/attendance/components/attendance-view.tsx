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
import { RefreshButton } from "@/components/shared/refresh-button";
import { Button } from "@/components/ui/button";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { today } from "../lib/calendar";
import { isoOfDay, useToday } from "../use-today";
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
import { UpcomingLeave } from "./upcoming-leave";
import { PeopleAttentionCard } from "@/modules/insights/components/people-attention";
import { formatWallClock } from "../lib/clock";

export function AttendanceView() {
  // The roster reads `GET /v1/attendance/day` (`AttendanceReadTeam`/`Org` → `attendance:manage`),
  // not the directory bit the old shared rule keyed on (QA audit 2026-10-08, WP-322).
  const selfScoped = useIsSelfScoped(["attendance:manage"]);
  if (selfScoped) return <PersonalAttendanceView />;
  return <OversightAttendance />;
}

function OversightAttendance() {
  const { can } = usePermissions();
  // Shared filter: a Today/Week/Month/Custom range (or a specific "day") + a department.
  const [range, setRange] = useState<AttendanceRange>("today");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dept, setDept] = useState("all");
  // The real today, re-read at midnight (QA audit 2026-10-08, WP-258).
  const now = useToday();
  // The picked day drives the "day" range and the calendar's month. On Today the date *is* today,
  // so it follows the clock past midnight instead of keeping the day the page was opened on.
  const [picked, setPicked] = useState<AttendanceDate>(today);
  const date = range === "today" ? now : picked;

  // Selecting a day (picker or calendar) shows that specific date — except today itself, which is
  // the live Today view. As a "day" it has no closed record by construction, so picking it used to
  // swap the live roster for "No records" (QA audit 2026-10-08, WP-255).
  const selectDay = (d: AttendanceDate) => {
    if (isoOfDay(d) === isoOfDay(now)) {
      setRange("today");
      return;
    }
    setPicked(d);
    setRange("day");
  };

  /**
   * Range and date are two halves of one selection, so every transition must move both.
   *
   * `selectDay` already did. The range buttons were wired straight to `setRange`, so pressing
   * **Today** refetched the data — the hook reads `range` — while `date` stayed on whatever day was
   * last picked. The chart showed today; the date picker, the heading and the calendar highlight
   * (all driven by `date`) still showed the old day, with nothing to say which was current. Leaving
   * Today starts the next range from today too.
   */
  const changeRange = (r: AttendanceRange) => {
    if (r === "today" || range === "today") setPicked({ ...now });
    setRange(r);
  };

  // The active filter's data (counts + roster).
  const data = useOversightAttendance({ range, dept, date, start, end });

  // A separate always-"today" read for the header — so the live headline stays live even while the
  // body shows a past range. `dept` is honoured so the headline tracks the department filter.
  // While the body is itself on Today the two are the same query, so the body's answers the header
  // and this one stays switched off (it doubled every request on load; WP-272).
  const onToday = range === "today";
  const liveSeparate = useOversightAttendance({
    range: "today",
    dept,
    date,
    start: "",
    end: "",
    enabled: !onToday,
  });
  const live = onToday ? data : liveSeparate;
  const livePct = live.counts.total
    ? Math.round((live.counts.present / live.counts.total) * 100)
    : 0;
  // Never a percentage the page doesn't have: a failed read said "0% of the team clocked in"
  // (QA audit 2026-10-08, WP-113), and a weekend said 0 % with everyone absent (WP-254).
  const liveDescription = live.loading
    ? "Today · presence loading…"
    : live.error
      ? "Today · presence unavailable"
      : live.todayOff
        ? `Today · not a working day${
            live.counts.present > 0 ? ` — ${live.counts.present} clocked in` : ""
          }`
        : live.counts.total === 0
          ? "Today · nobody is expected at work"
          : (live.counts.notInYet ?? 0) > 0
            ? // Before "Late after" a percentage reads as an attendance verdict the day hasn't
              // reached yet — "0 % clocked in" at 08:00 (UX audit 2026-10-16, TIME-11).
              `Today · ${live.counts.present} of ${live.counts.total} in so far · late after ${formatWallClock(live.lateAfter)}`
            : `Today · ${livePct}% of the team clocked in`;

  // The calendar shows the selected date's month, fed by the real month fan-out — fetched only while
  // the (collapsed-by-default) calendar is open.
  const [calendarOpen, setCalendarOpen] = useState(false);
  const month = useMonthAttendance(date.year, date.month, calendarOpen);

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
      // A failed read is not a set of zeros (WP-113).
      ...(data.error
        ? [{ label: "Attendance", value: "couldn't be loaded" }]
        : [
            { label: "Present", value: String(data.counts.present) },
            { label: "On leave", value: String(data.counts.leave) },
            // Expected people only — a day off and an unread day are not in it (WP-253/WP-254).
            { label: "Counted toward the rate", value: String(data.counts.total) },
          ]),
    ],
  });

  // Correcting a closed day (the admin day-override): `attendance:edit` holders, in **every** tracking
  // mode since 2026-10-17. It was managed-agent orgs only, on the grounds that project orgs have the
  // leave workflow — which can't reach a day already past, so a sick day stayed "Absent" for good
  // (UX audit 2026-10-16, TIME-04).
  const correction =
    range === "day" && data.mode === "day" && can("attendance:edit")
      ? { date: iso, onSaved: data.reload }
      : null;

  return (
    // No bottom padding of its own: the shell reserves the assistant button's room (XC-03).
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={liveDescription}
        actions={
          <RefreshButton
            onRefresh={() => {
              data.reload();
              if (!onToday) liveSeparate.reload();
              month.reload();
            }}
            refreshing={data.loading || live.loading || month.loading}
          />
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
          error={data.error}
          note={data.note}
          // The org's "Late after" in the viewer's clock, like every other time here (TIME-14).
          lateAfter={data.lateAfter ? formatWallClock(data.lateAfter) : undefined}
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
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        summarize={data.summarizeDay}
        deptLabel={dept === "all" ? null : dept}
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
        correction={correction}
      />

      {/* After the roster, before "who do I chase": the roster answers who is out today, this
          answers who will be. Collapsed by default so it costs no request until asked for — it
          reads the approvals queue, which the day's view does not otherwise need. That queue needs
          the approver's permission, so it is offered only to approvers: anyone else could only
          ever open it to "Couldn't load upcoming leave" (QA audit 2026-10-08, WP-474). */}
      {can("approvals:view") ? <UpcomingLeave /> : null}

      {/* Last on the page, deliberately. It is the follow-up *after* reading the day — the numbers,
          then the calendar, then the roster, and only then "who do I chase". Above the roster it
          asked the question before the page had shown the evidence for it.
          Given the page's own `iso`, so it renders no second date control: the card always
          describes the day the rest of the page is showing. */}
      <PeopleAttentionCard date={iso} />
    </div>
  );
}
