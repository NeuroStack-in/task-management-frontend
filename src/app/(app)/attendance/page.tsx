import type { Metadata } from "next";
import { AttendanceView } from "@/modules/attendance/components/attendance-view";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  return <AttendanceView />;
}
