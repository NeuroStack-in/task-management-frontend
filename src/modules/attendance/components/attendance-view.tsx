"use client";

import { useRef, useState } from "react";
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
  const logRef = useRef<HTMLDivElement>(null);

  if (selfScoped) return <PersonalAttendanceView />;

  const today = orgDayCounts(TODAY.year, TODAY.month, TODAY.day);
  const presentPct = Math.round(
    ((today.present + today.late) / today.total) * 100,
  );

  // Picking a day on the calendar updates the log and scrolls down to it.
  const selectDay = (d: AttendanceDate) => {
    setDate(d);
    requestAnimationFrame(() =>
      logRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={`Today · ${presentPct}% of the team clocked in`}
      />

      <AttendanceOverview />

      <AttendanceCalendar selected={date} onSelect={selectDay} />

      <div ref={logRef} className="scroll-mt-4">
        <AttendanceLog date={date} onDateChange={setDate} />
      </div>
    </div>
  );
}
