/**
 * Deterministic derived metrics over the mock dataset. No randomness, so values
 * are stable across renders/reloads (SPEC.md §5). Server-safe.
 */
import type { User, UserStatus } from "@/types/user";
import { dayRecordFor, TODAY, type DayStatus } from "@/lib/mock-attendance";

export type AttendanceStatus = DayStatus;

export interface AttendanceRecord {
  status: AttendanceStatus;
  clockIn: string;
  clockOut: string;
  hours: number;
}

/**
 * Per-user attendance for "today". Delegates to `dayRecordFor` — the single
 * source of truth — so the dashboard's attendance donut agrees with the
 * Attendance page, the log, and payroll.
 */
export function attendanceFor(id: string): AttendanceRecord {
  return dayRecordFor(id, TODAY.year, TODAY.month, TODAY.day);
}

export function attendanceCounts(
  list: User[],
): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = {
    present: 0,
    late: 0,
    leave: 0,
    absent: 0,
  };
  for (const u of list) counts[attendanceFor(u.id).status] += 1;
  return counts;
}

export function statusCounts(list: User[]): Record<UserStatus, number> {
  const counts: Record<UserStatus, number> = {
    active: 0,
    inactive: 0,
    invited: 0,
    suspended: 0,
  };
  for (const u of list) counts[u.status] += 1;
  return counts;
}

/**
 * 7×12 productivity intensity grid (days × work hours 8:00–19:00), 0–100.
 * Shaped like a real work pattern: morning + afternoon peaks, a lunch dip, and
 * quiet weekends.
 */
export function productivityHeatmap(): number[][] {
  const grid: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    const weekend = d >= 5;
    for (let h = 0; h < 12; h++) {
      const hour = 8 + h;
      let v =
        40 +
        45 * Math.exp(-((hour - 11) ** 2) / 8) +
        35 * Math.exp(-((hour - 15) ** 2) / 6);
      if (hour === 12 || hour === 13) v -= 16;
      if (weekend) v *= d === 5 ? 0.35 : 0.18;
      v += ((d * 7 + h * 13) % 9) - 4;
      row.push(Math.max(4, Math.min(100, Math.round(v))));
    }
    grid.push(row);
  }
  return grid;
}

export const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HEATMAP_HOURS = [
  "8a",
  "",
  "10a",
  "",
  "12p",
  "",
  "2p",
  "",
  "4p",
  "",
  "6p",
  "",
];
