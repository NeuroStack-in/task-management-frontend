/**
 * Attendance — the real backend (`time-attendance` context, LLD §7).
 *
 * `GET /v1/me/attendance?from&to` — the caller's own resolved days plus a summary. Status is
 * **computed by the 00:15 close cron**, never tracked: nobody can set "present", which is the point
 * for a record that feeds payroll.
 *
 * ## The working window (clock-in / clock-out)
 *
 * `AttendanceDay` itself carries only a *status* and total worked minutes — no first/last punch. The
 * clock times live on the day's `TIME#` timer sessions, so the server now **enriches** each day's
 * `AttendanceDayRow` with `clock_in`/`clock_out` (epoch ms) read from those sessions. A running
 * session moves `clock_in` but leaves `clock_out` absent (still open), matching the timesheet. The
 * daily *verdict* (status) is still the cron's; the window is just the sessions' span, surfaced.
 *
 * Only days the cron has actually **closed** come back — today and the future are simply absent,
 * never pre-stamped "absent" (that would slander a day still in progress).
 */
import { apiFetch } from "@/lib/api";

/** The five-status model (LLD §7). `late` is a qualifier on `present`, not a sixth status. */
export type AttendanceStatus =
  | "present"
  | "partial"
  | "absent"
  | "leave"
  | "non_workday";

/** Mirrors `time_attendance::personal_attendance::dto::AttendanceDayRow`. */
export interface ApiAttendanceDay {
  date: string;
  status: AttendanceStatus;
  late: boolean;
  worked_minutes: number;
  /** The day's working window, enriched from the caller's timer sessions. Epoch **ms**; absent when
   *  the day had no session (didn't clock in) or a session is still running (`clock_out` only). */
  clock_in?: number;
  clock_out?: number;
}

/** Mirrors the `Summary`. `non_workday` is excluded from every tally, per §7. */
export interface ApiAttendanceSummary {
  present: number;
  late: number;
  partial: number;
  absent: number;
  leave: number;
  /** Days that count toward the rate's denominator (everything but non_workday). */
  counted: number;
}

export interface ApiAttendanceResponse {
  from: string;
  to: string;
  days: ApiAttendanceDay[];
  summary: ApiAttendanceSummary;
}

/**
 * The caller's own attendance for a date range (max 92 days server-side).
 *
 * `from`/`to` are `YYYY-MM-DD` in the **client's** local calendar — the same reason the timesheet
 * demands a client date: the Lambda runs in UTC and cannot know the user's timezone.
 */
export function getMyAttendance(
  from: string,
  to: string,
): Promise<ApiAttendanceResponse> {
  const q = new URLSearchParams({ from, to });
  return apiFetch<ApiAttendanceResponse>(`/v1/me/attendance?${q}`);
}

// ── Oversight (manager view) ─────────────────────────────────────────────────────────────────

/** One user's status on a queried day. Status only — GSI3 projects nothing else (see the backend). */
export interface ApiDayUser {
  user_id: string;
  status: AttendanceStatus;
}

export interface ApiDaySummary {
  present: number;
  partial: number;
  absent: number;
  leave: number;
  non_workday: number;
  counted: number;
}

export interface ApiDayResponse {
  date: string;
  users: ApiDayUser[];
  summary: ApiDaySummary;
}

/**
 * `GET /v1/attendance/day?date=` — everyone's status for one day (needs `AttendanceReadTeam`).
 *
 * Status only: `late`/`worked_minutes` are not on the GSI3 index this reads, so the oversight grid
 * answers "who was in / out / on leave", and a per-person drill-down uses `getMyAttendance`.
 */
export function getDayOversight(date: string): Promise<ApiDayResponse> {
  const q = new URLSearchParams({ date });
  return apiFetch<ApiDayResponse>(`/v1/attendance/day?${q}`);
}

/** Mirrors `time-attendance::user_day::UserDayDetail` — one employee's day of clock-in/out + hours. */
export interface ApiUserDayDetail {
  user_id: string;
  date: string;
  /** Resolved status once the 00:15 close ran; absent while the day is still open (today). */
  status?: AttendanceStatus;
  late: boolean;
  /** An approved leave request covers this date — true even before the close cron runs, so the live
   *  "today" roster can show "On leave" on a day with no resolved status yet. */
  on_leave: boolean;
  /** Epoch **ms** of the first timer start. Absent = didn't clock in. */
  clock_in?: number;
  /** Epoch **ms** of the last session's stop. Absent while a session is still running. */
  clock_out?: number;
  worked_minutes: number;
  /** A session is open (clocked in, not yet out) — clock_out is deliberately absent. */
  running: boolean;
  entry_count: number;
}

/**
 * `GET /v1/attendance/user/{id}?date=` — one employee's clock-in/out + worked hours for a day
 * (needs `AttendanceReadTeam`). Reads their `TIME#` sessions directly, so it works for **today** too:
 * `clock_in` = first timer start; `clock_out` = last stop, or absent while a timer is still running.
 */
export function getUserDay(
  userId: string,
  date: string,
): Promise<ApiUserDayDetail> {
  const q = new URLSearchParams({ date });
  return apiFetch<ApiUserDayDetail>(
    `/v1/attendance/user/${encodeURIComponent(userId)}?${q}`,
  );
}
