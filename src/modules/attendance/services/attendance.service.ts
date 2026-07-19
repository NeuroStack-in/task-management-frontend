/**
 * Attendance — the real backend (`time-attendance` context, LLD §7).
 *
 * `GET /v1/me/attendance?from&to` — the caller's own resolved days plus a summary. Status is
 * **computed by the 00:15 close cron**, never tracked: nobody can set "present", which is the point
 * for a record that feeds payroll.
 *
 * ## What the server does NOT serve, and how the view copes
 *
 * The mock calendar showed clock-in/clock-out times per day. The attendance read has no such thing —
 * `AttendanceDay` carries a *status* and total worked minutes, not a first/last punch. So this maps
 * `worked_minutes → hours` and leaves the clock columns empty rather than inventing punches. The
 * timesheet (`/v1/me/timesheet/today`) is where per-session start/stop lives; attendance is the
 * daily verdict, not the log.
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
