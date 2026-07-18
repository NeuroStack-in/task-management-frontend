/**
 * Residual **fabricated** attendance generator for the still-mock modules
 * (Payroll and Locations). The wired Attendance module does NOT use this — it
 * reads real records from the backend. This file exists only so those two mock
 * modules keep their deterministic sample data after `lib/mock-attendance.ts`
 * (which used to host `dayRecordFor`) was deleted; the pure calendar math moved
 * to `modules/attendance/lib/calendar.ts`, but fabricated punches/hours have no
 * place in a pure helper, so they land here instead.
 *
 * Deterministic: explicit `new Date(y, m, d)` args, no `Date.now()` /
 * `Math.random()`, so a given person + date always renders the same.
 */
import { type DayStatus, type DayRecord } from "@/types/attendance";

const hash = (id: string) =>
  [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Deterministic per-person status for a given working day, in LLD §7's resolution
 * order (first match wins). `late` is a **qualifier on present**, so it's returned
 * alongside the status, never as one of them.
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
 * Deterministic per-person attendance record for a specific date. Varies by
 * person and date; weekends skew heavily to "off the clock".
 */
export function dayRecordFor(
  id: string,
  year: number,
  month: number,
  day: number,
): DayRecord {
  const weekday = mondayIndex(new Date(year, month, day).getDay());
  const s = hash(id);

  // A weekend is a non_workday — excluded from the expected set, NOT an absence (LLD §7).
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
