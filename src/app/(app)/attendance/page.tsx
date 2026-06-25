import type { Metadata } from "next";
import { users } from "@/lib/data";
import { attendanceFor } from "@/lib/mock-metrics";
import { PageHeader } from "@/components/shared/page-header";
import { AttendanceOverview } from "@/modules/attendance/components/attendance-overview";
import { AttendanceCalendar } from "@/modules/attendance/components/attendance-calendar";
import { AttendanceLog } from "@/modules/attendance/components/attendance-log";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  const rows = users.map((u) => attendanceFor(u.id));
  const clockedIn = rows.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const presentPct = Math.round((clockedIn / rows.length) * 100);

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={`Today · ${presentPct}% of the team clocked in`}
      />

      <AttendanceOverview />

      <AttendanceCalendar />

      <AttendanceLog />
    </div>
  );
}
