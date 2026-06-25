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

/** Static parts of the "Today" overview header (deltas, log hours). */
export const OVERVIEW = {
  rateDelta: 2.8,
  attendedDelta: 2.8,
  logHours: "234:12:23",
  logHoursTarget: "300:00:00",
  logHoursDelta: -0.5,
};

export interface DeptPerformance {
  dept: string;
  /** Attendance rate % (gauge value). */
  rate: number;
  /** Employee performance %. */
  perf: number;
  /** Logged working hours. */
  hours: string;
}

/** Per-department working-hour performance (gauge tabs). */
export const DEPARTMENT_PERFORMANCE: DeptPerformance[] = [
  { dept: "Marketing", rate: 89, perf: 86, hours: "234:12:23" },
  { dept: "Developer", rate: 93, perf: 91, hours: "268:40:10" },
  { dept: "Creative", rate: 82, perf: 78, hours: "201:18:44" },
  { dept: "Support", rate: 88, perf: 84, hours: "220:05:30" },
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
