"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import {
  TODAY,
  orgDayCounts,
  type AttendanceRange,
} from "@/lib/mock-attendance";
import { users } from "@/lib/data";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { AttendanceOverview } from "./attendance-overview";
import { AttendanceCalendar } from "./attendance-calendar";
import { AttendanceLog } from "./attendance-log";
import { PersonalAttendanceView } from "./personal-attendance-view";

export interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

/** Distinct departments for the shared filter (static — users is seed data). */
const DEPARTMENTS = [
  "all",
  ...[...new Set(users.map((u) => u.department))].sort(),
];

export function AttendanceView() {
  // Self-scoped roles (Employee) see only their own attendance, never the org.
  const selfScoped = useIsSelfScoped();

  // Shared filter: a Today/Week/Month/Custom range (or a specific "day") + dept.
  const [range, setRange] = useState<AttendanceRange>("today");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dept, setDept] = useState("all");
  // The selected day drives the log below (and the "day" range in the overview).
  const [date, setDate] = useState<AttendanceDate>({ ...TODAY });

  // Selecting a day (via the picker or the calendar) shows that specific date.
  const selectDay = (d: AttendanceDate) => {
    setDate(d);
    setRange("day");
  };

  if (selfScoped) return <PersonalAttendanceView />;

  const today = orgDayCounts(TODAY.month, TODAY.day);
  const presentPct = Math.round(
    ((today.present + today.late) / today.total) * 100,
  );

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={`Today · ${presentPct}% of the team clocked in`}
      />

      {/* The overview card carries the shared filter (range + department) in its
          top-right, Today by default. The calendar below drills into a day. */}
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
        departments={DEPARTMENTS}
      />

      <AttendanceCalendar selected={date} onSelect={selectDay} />

      <AttendanceLog
        range={range}
        date={date}
        start={start}
        end={end}
        dept={dept}
      />
    </div>
  );
}
