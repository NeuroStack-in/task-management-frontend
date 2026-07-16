/**
 * Deterministic derived metrics over the mock dataset. No randomness, so values
 * are stable across renders/reloads (SPEC.md §5). Server-safe.
 */
import type { User, UserStatus } from "@/types/user";
import type { DayStatus } from "@/types/attendance";

/**
 * @deprecated Use `DayStatus` from `@/types/attendance` — this alias only exists so the
 * rename stayed a one-line change at each call site. There was a second, drifted copy of
 * this union here; both are now the one model that mirrors the backend (LLD §7).
 */
export type AttendanceStatus = DayStatus;

export interface AttendanceRecord {
  status: DayStatus;
  /** Qualifier on `present` — never a status of its own (LLD §7). */
  late: boolean;
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
  // LLD §7 resolution order: leave → non_workday → absent → partial → present.
  // `late` qualifies present; it is not a status.
  const status: DayStatus =
    r < 1 ? "leave" : r < 2 ? "absent" : r < 3 ? "partial" : "present";
  const late = status === "present" && r >= 8;
  const lateMin = (seed % 24) + 6;
  const clockIn =
    status === "present"
      ? late
        ? `09:${lateMin}`
        : `09:0${seed % 6}`
      : status === "partial"
        ? `10:${(seed % 50).toString().padStart(2, "0")}`
        : "—";
  const clockOut =
    status === "present"
      ? `17:${10 + (seed % 40)}`
      : status === "partial"
        ? `13:${10 + (seed % 45)}`
        : "—";
  const hours =
    status === "present"
      ? late
        ? 7 + (seed % 6) / 10
        : 8 + (seed % 5) / 10
      : status === "partial"
        ? 2 + (seed % 15) / 10
        : 0;
  return { status, late, clockIn, clockOut, hours };
}

/**
 * Tally by status, plus `late` as a **subset of `present`** — not a peer.
 * `present` already includes late arrivals; adding them double-counts (LLD §7).
 */
export function attendanceCounts(
  list: User[],
): Record<DayStatus, number> & { late: number } {
  const counts = {
    present: 0,
    partial: 0,
    leave: 0,
    absent: 0,
    non_workday: 0,
    late: 0,
  };
  for (const u of list) {
    const { status, late } = attendanceFor(u.id);
    counts[status] += 1;
    if (late) counts.late += 1;
  }
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
