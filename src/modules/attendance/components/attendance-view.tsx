"use client";

import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { PersonalAttendanceView } from "./personal-attendance-view";
import { OversightAttendanceView } from "./oversight-attendance-view";

export function AttendanceView() {
  // Self-scoped roles (Employee) see only their own attendance (real: /v1/me/attendance).
  // Everyone else gets the team day-oversight view (real: /v1/attendance/day).
  const selfScoped = useIsSelfScoped();
  return selfScoped ? <PersonalAttendanceView /> : <OversightAttendanceView />;
}
