/**
 * Deterministic data for the Attendance calendar (SPEC.md §3, Attendance).
 * Pure date math with explicit `new Date(y, m, d)` args (no `Date.now()` /
 * `Math.random()`), so the month grid is stable across renders.
 *
 * Each working day carries the organization-wide attendance breakdown
 * (present / late / on-leave / absent), tallied across the employed headcount.
 */
import { users } from "@/lib/data";
import { type DayStatus, type DayCounts, type DayRecord } from "@/types/attendance";

export {
  isCounted,
  DAY_STATUS_LABEL,
  type DayStatus,
  type DayCounts,
  type DayRecord,
} from "@/types/attendance";

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

/**
 * Deterministic per-person status for a given working day, in LLD §7's resolution
 * order (first match wins). `late` is a **qualifier on present**, so it's returned
 * alongside the status, never as one of them.
 *
 * Callers pass working days only — `non_workday` is decided by the calendar
 * (`isWorkday`), not by this dice roll.
 */
function personStatus(
  id: string,
  month: number,
  day: number,
): { status: Exclude<DayStatus, "non_workday">; late: boolean } {
  const r = (hash(id) * 31 + day * 17 + month * 7) % 100;
  // 1. leave → 2. (non_workday, decided by the calendar) → 3. absent → 4. partial → 5. present
  if (r < 7) return { status: "leave", late: false };
  if (r < 12) return { status: "absent", late: false };
  if (r < 18) return { status: "partial", late: false };
  // present — late qualifies it, and roughly a fifth of present days are late.
  return { status: "present", late: r < 30 };
}

/**
 * Attendance counts for one working day, optionally narrowed to a department.
 * `dept === "all"` (default) tallies the whole employed headcount.
 */
export function orgDayCounts(
  month: number,
  day: number,
  dept = "all",
): DayCounts {
  const people =
    dept === "all"
      ? HEADCOUNT
      : HEADCOUNT.filter((u) => u.department === dept);
  const counts: DayCounts = {
    present: 0,
    late: 0,
    partial: 0,
    leave: 0,
    absent: 0,
    total: people.length,
  };
  for (const u of people) {
    const { status, late } = personStatus(u.id, month, day);
    counts[status] += 1;
    // `late` is a SUBSET of present, not a peer — it's already counted above.
    // Adding present + late would double-count every late arrival.
    if (late) counts.late += 1;
  }
  return counts;
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
  const s = hash(id);

  // Resolution step 2: a weekend is a non_workday — excluded from the expected set,
  // NOT an absence. Weekends previously resolved to "absent", which put every Saturday
  // in the denominator and made the absence rate look catastrophic (LLD §7).
  if (weekday >= 5) {
    return { status: "non_workday", late: false, clockIn: "—", clockOut: "—", hours: 0 };
  }

  const { status, late } = personStatus(id, month, day);

  if (status === "present") {
    return late
      ? {
          status,
          late,
          clockIn: `09:${pad2((s % 24) + 6)}`,
          clockOut: `17:${10 + (s % 30)}`,
          hours: 7 + (s % 6) / 10,
        }
      : {
          status,
          late,
          clockIn: `09:0${s % 6}`,
          clockOut: `17:${10 + (s % 40)}`,
          hours: 8 + (s % 5) / 10,
        };
  }
  if (status === "partial") {
    // A session exists, but under `min_present_minutes` — so it has real clock times
    // and non-zero hours. That is exactly what distinguishes it from absent.
    return {
      status,
      late,
      clockIn: `10:${pad2(s % 50)}`,
      clockOut: `13:${pad2(10 + (s % 45))}`,
      hours: 2 + (s % 15) / 10,
    };
  }
  return { status, late, clockIn: "—", clockOut: "—", hours: 0 };
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
  const sum: DayCounts = {
    present: 0,
    late: 0,
    partial: 0,
    leave: 0,
    absent: 0,
    total: 0,
  };
  for (const c of days) {
    sum.present += c.counts!.present;
    sum.late += c.counts!.late;
    sum.partial += c.counts!.partial;
    sum.leave += c.counts!.leave;
    sum.absent += c.counts!.absent;
  }
  const n = days.length || 1;
  return {
    present: Math.round(sum.present / n),
    late: Math.round(sum.late / n),
    partial: Math.round(sum.partial / n),
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

/* ------------------------------ Range filter ------------------------------ */

export type AttendanceRange = "today" | "week" | "month" | "custom" | "day";

/** The segmented quick-ranges. "day" is driven by the date picker, not a button. */
export const ATTENDANCE_RANGE_OPTIONS: {
  value: AttendanceRange;
  label: string;
}[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

/** Working days (Mon–Fri) between two dates, inclusive. */
function workdaysBetween(
  startD: Date,
  endD: Date,
): { year: number; month: number; day: number }[] {
  const out: { year: number; month: number; day: number }[] = [];
  const d = new Date(startD);
  let guard = 0;
  while (d.getTime() <= endD.getTime() && guard < 400) {
    if (mondayIndex(d.getDay()) < 5) {
      out.push({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
    }
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

/**
 * Aggregated attendance for a range (today / week / month / custom), optionally
 * narrowed to a department. Averages daily counts across the range's working
 * days, so the rate stays comparable regardless of how long the range is.
 */
/** The working days (and a label) covered by a range / custom / day selection. */
export function rangeDays(
  range: AttendanceRange,
  date?: { year: number; month: number; day: number },
  start?: string,
  end?: string,
): { days: { year: number; month: number; day: number }[]; label: string } {
  const today = new Date(TODAY.year, TODAY.month, TODAY.day);

  if (range === "week") {
    const mon = new Date(today);
    mon.setDate(today.getDate() - mondayIndex(today.getDay()));
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { days: workdaysBetween(mon, fri), label: "This week" };
  }
  if (range === "month") {
    const first = new Date(TODAY.year, TODAY.month, 1);
    const last = new Date(TODAY.year, TODAY.month + 1, 0);
    return { days: workdaysBetween(first, last), label: "This month" };
  }
  if (range === "custom" && start && end) {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    return {
      days: workdaysBetween(s, e),
      label: `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getDate()}`,
    };
  }
  if (range === "day" && date) {
    return {
      days: [{ ...date }],
      label: `${MONTH_NAMES[date.month].slice(0, 3)} ${date.day}, ${date.year}`,
    };
  }
  // "today" (and "custom" before both bounds are picked)
  return { days: [{ ...TODAY }], label: "Today" };
}

export function rangeSummary(
  range: AttendanceRange,
  dept = "all",
  date?: { year: number; month: number; day: number },
  start?: string,
  end?: string,
): { counts: DayCounts; label: string; days: number } {
  const { days, label } = rangeDays(range, date, start, end);

  const acc = { present: 0, late: 0, partial: 0, leave: 0, absent: 0, total: 0 };
  for (const d of days) {
    const c = orgDayCounts(d.month, d.day, dept);
    acc.present += c.present;
    acc.late += c.late;
    acc.partial += c.partial;
    acc.leave += c.leave;
    acc.absent += c.absent;
    acc.total = c.total;
  }
  const n = days.length || 1;
  return {
    counts: {
      present: Math.round(acc.present / n),
      late: Math.round(acc.late / n),
      partial: Math.round(acc.partial / n),
      leave: Math.round(acc.leave / n),
      absent: Math.round(acc.absent / n),
      total: acc.total,
    },
    label,
    days: days.length,
  };
}

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
