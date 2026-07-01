"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { TODAY, orgDayCounts } from "@/lib/mock-attendance";
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

export function AttendanceView() {
  // Self-scoped roles (Employee) see only their own attendance, never the org.
  const selfScoped = useIsSelfScoped();

  // Shared selected day — the calendar drives the log below it.
  const [date, setDate] = useState<AttendanceDate>({ ...TODAY });
  // Department is fixed to Design in the management view (shown as a static label).
  const dept = "Design";

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

      <AttendanceCalendar selected={date} onSelect={setDate} dept={dept} />

      <AttendanceLog date={date} dept={dept} />
    </div>
  );
}
