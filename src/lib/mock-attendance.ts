/**
 * Deterministic data for the Attendance calendar (SPEC.md §3, Attendance).
 * Pure date math with explicit `new Date(y, m, d)` args (no `Date.now()` /
 * `Math.random()`), so the month grid is stable across renders.
 *
 * Each working day carries the organization-wide attendance breakdown
 * (present / late / on-leave / absent), tallied across the employed headcount.
 */
import { users } from "@/lib/data";

export type DayStatus = "present" | "late" | "leave" | "absent";

export interface DayCounts {
  present: number;
  late: number;
  leave: number;
  absent: number;
  total: number;
}

/** The month the calendar opens on, and "today" (mirrors the demo clock). */
export const REFERENCE_MONTH = { year: 2026, month: 5 }; // June 2026 (0-indexed)
export const TODAY = { year: 2026, month: 5, day: 25 };

export interface DayCell {
  day: number;
  month: number;
  year: number;
  inMonth: boolean;
  /** 0 = Mon … 6 = Sun. */
  weekday: number;
  /** Weekday (Mon–Fri) and in-month → has org counts. */
  isWorkday: boolean;
  isToday: boolean;
  counts: DayCounts | null;
}

/** Employed headcount the attendance is measured against (excludes invited/suspended). */
const HEADCOUNT = users.filter(
  (u) => u.status === "active" || u.status === "inactive",
);

const hash = (id: string) =>
  [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Deterministic per-person status for a given working day. */
function personStatus(id: string, month: number, day: number): DayStatus {
  const r = (hash(id) * 31 + day * 17 + month * 7) % 100;
  if (r < 5) return "absent";
  if (r < 12) return "leave";
  if (r < 24) return "late";
  return "present";
}

/** Organization-wide attendance counts for one working day. */
export function orgDayCounts(month: number, day: number): DayCounts {
  const counts: DayCounts = {
    present: 0,
    late: 0,
    leave: 0,
    absent: 0,
    total: HEADCOUNT.length,
  };
  for (const u of HEADCOUNT) counts[personStatus(u.id, month, day)] += 1;
  return counts;
}

export interface DayRecord {
  status: DayStatus;
  clockIn: string;
  clockOut: string;
  hours: number;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Deterministic per-person attendance record for a specific date — used by the
 * log so past days can be looked up. Varies by person and date; weekends skew
 * heavily to "off the clock".
 */
export function dayRecordFor(
  id: string,
  year: number,
  month: number,
  day: number,
): DayRecord {
  const weekday = mondayIndex(new Date(year, month, day).getDay());
  const r = (hash(id) * 31 + day * 17 + month * 7 + year) % 100;
  let status: DayStatus =
    r < 5 ? "absent" : r < 12 ? "leave" : r < 24 ? "late" : "present";
  if (weekday >= 5) status = r < 78 ? "absent" : "present"; // weekends

  const s = hash(id);
  if (status === "present") {
    return {
      status,
      clockIn: `09:0${s % 6}`,
      clockOut: `17:${10 + (s % 40)}`,
      hours: 8 + (s % 5) / 10,
    };
  }
  if (status === "late") {
    return {
      status,
      clockIn: `09:${pad2((s % 24) + 6)}`,
      clockOut: `17:${10 + (s % 30)}`,
      hours: 7 + (s % 6) / 10,
    };
  }
  return { status, clockIn: "—", clockOut: "—", hours: 0 };
}

/** Is the date in the future relative to the demo "today"? (No records yet.) */
export function isFutureDate(year: number, month: number, day: number): boolean {
  return (
    new Date(year, month, day).getTime() >
    new Date(TODAY.year, TODAY.month, TODAY.day).getTime()
  );
}

/**
 * Six-week (Monday-first) matrix for a month, including leading/trailing days
 * from adjacent months (flagged `inMonth: false`). Working days carry counts.
 */
export function monthMatrix(year: number, month: number): DayCell[][] {
  const firstWeekday = mondayIndex(new Date(year, month, 1).getDay());
  const total = daysInMonth(year, month);
  const prevTotal = daysInMonth(year, month - 1);

  const make = (d: number, m: number, y: number, inMonth: boolean): DayCell => {
    const weekday = mondayIndex(new Date(y, m, d).getDay());
    const isWorkday = inMonth && weekday < 5;
    return {
      day: d,
      month: m,
      year: y,
      inMonth,
      weekday,
      isWorkday,
      isToday:
        inMonth && y === TODAY.year && m === TODAY.month && d === TODAY.day,
      counts: isWorkday ? orgDayCounts(m, d) : null,
    };
  };

  const cells: DayCell[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevTotal - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push(make(d, m, y, false));
  }
  for (let d = 1; d <= total; d++) cells.push(make(d, month, year, true));
  let nextDay = 1;
  while (cells.length < 42) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push(make(nextDay++, m, y, false));
  }

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
  return weeks;
}

/** Month-wide rollup (average per working day) for the header summary. */
export function monthSummary(year: number, month: number): DayCounts {
  const days = monthMatrix(year, month)
    .flat()
    .filter((c) => c.isWorkday && c.counts);
  const sum: DayCounts = { present: 0, late: 0, leave: 0, absent: 0, total: 0 };
  for (const c of days) {
    sum.present += c.counts!.present;
    sum.late += c.counts!.late;
    sum.leave += c.counts!.leave;
    sum.absent += c.counts!.absent;
  }
  const n = days.length || 1;
  return {
    present: Math.round(sum.present / n),
    late: Math.round(sum.late / n),
    leave: Math.round(sum.leave / n),
    absent: Math.round(sum.absent / n),
    total: HEADCOUNT.length,
  };
}

/** Total employed headcount (denominator for attendance). */
export const HEADCOUNT_TOTAL = HEADCOUNT.length;

/** Static parts of the "Today" overview header (week-over-week deltas). */
export const OVERVIEW = {
  rateDelta: 2.8,
  attendedDelta: 2.8,
};

export interface DeptAttendance {
  dept: string;
  /** Attendance rate % (gauge value). */
  rate: number;
  present: number;
  leave: number;
  absent: number;
}

/** Per-department attendance (gauge tabs). */
export const DEPARTMENT_ATTENDANCE: DeptAttendance[] = [
  { dept: "Marketing", rate: 92, present: 22, leave: 1, absent: 1 },
  { dept: "Developer", rate: 95, present: 38, leave: 1, absent: 1 },
  { dept: "Creative", rate: 88, present: 14, leave: 1, absent: 1 },
  { dept: "Support", rate: 90, present: 18, leave: 2, absent: 1 },
];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The three headline metrics shown per day + their colours. */
export const COUNT_METRICS: {
  key: keyof Omit<DayCounts, "total">;
  label: string;
  dot: string;
  text: string;
  /** Soft tinted chip surface (bg + text). */
  chip: string;
}[] = [
  {
    key: "present",
    label: "Present",
    dot: "bg-success",
    text: "text-success",
    chip: "bg-success/12 text-success",
  },
  {
    key: "leave",
    label: "On leave",
    dot: "bg-primary",
    text: "text-primary",
    chip: "bg-primary/12 text-primary",
  },
  {
    key: "absent",
    label: "Absent",
    dot: "bg-destructive",
    text: "text-destructive",
    chip: "bg-destructive/10 text-destructive",
  },
];
