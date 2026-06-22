/**
 * Deterministic derived metrics over the mock dataset. No randomness, so values
 * are stable across renders/reloads (SPEC.md §5). Server-safe.
 */
import type { User, UserStatus } from "@/types/user";

export type AttendanceStatus = "present" | "late" | "leave" | "absent";

export interface AttendanceRecord {
  status: AttendanceStatus;
  clockIn: string;
  clockOut: string;
  hours: number;
}

function seedOf(id: string): number {
  return [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
}

/** Deterministic per-user attendance for "today". */
export function attendanceFor(id: string): AttendanceRecord {
  const seed = seedOf(id);
  const r = seed % 10;
  const status: AttendanceStatus =
    r < 6 ? "present" : r < 8 ? "late" : r < 9 ? "leave" : "absent";
  const lateMin = (seed % 24) + 6;
  const clockIn =
    status === "present"
      ? `09:0${seed % 6}`
      : status === "late"
        ? `09:${lateMin}`
        : "—";
  const clockOut =
    status === "present" || status === "late" ? `17:${10 + (seed % 40)}` : "—";
  const hours =
    status === "present"
      ? 8 + (seed % 5) / 10
      : status === "late"
        ? 7 + (seed % 6) / 10
        : 0;
  return { status, clockIn, clockOut, hours };
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
