"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TODAY, orgDayCounts } from "@/lib/mock-attendance";
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

  // Shared selected day — the calendar drives the log below it.
  const [date, setDate] = useState<AttendanceDate>({ ...TODAY });
  // Shared department filter — lives in the calendar header, narrows the log.
  const [dept, setDept] = useState("all");

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

      <AttendanceOverview />

      <AttendanceCalendar
        selected={date}
        onSelect={setDate}
        dept={dept}
        onDeptChange={setDept}
        departments={DEPARTMENTS}
      />

      <AttendanceLog date={date} dept={dept} />
    </div>
  );
}
