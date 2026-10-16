/**
 * Attendance — the real backend (`time-attendance` context, LLD §7).
 *
 * `GET /v1/me/attendance?from&to` — the caller's own resolved days plus a summary. Status is
 * **computed by the nightly close** (23:59 in the org's timezone), never tracked: nobody can set
 * "present", which is the point for a record that feeds payroll.
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
import { ApiError, apiFetch } from "@/lib/api";

/**
 * The attendance model (LLD §7). `late` is a qualifier on `present`, not a status of its own.
 *
 * **Permission is not a status either.** Short time off inside a working day (`docs/LEAVE.md`)
 * leaves the day resolving normally — the person turned up — and its minutes are credited toward
 * presence server-side so a properly-booked short day still reads `present`.
 *
 * `excused` is an admin day-override (managed-agent orgs). The server leaves it out of every
 * summary's `counted`, so the client tallies must too — see `isCounted`.
 */
export type AttendanceStatus =
  | "present"
  | "partial"
  | "absent"
  | "leave"
  | "non_workday"
  | "excused";

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

/** Mirrors `time-attendance::attendance_recompute::dto::RecomputeResponse`. */
export interface RecomputeResult {
  from: string;
  to: string;
  /** How many user-day statuses were re-stamped (summed across calls by `recomputeAttendance`). */
  recomputed: number;
  /** `false` when the server ran out of its per-call time budget; call again with `to = resume_to`. */
  done?: boolean;
  resume_to?: string;
}

/**
 * `POST /v1/attendance/recompute?from&to` — re-resolve already-closed days under the org's **current**
 * working-hours (needs `AttendanceManage`). Run after changing the schedule so past days pick up the
 * new working-days/thresholds instead of keeping the status they were closed with. `from`/`to` are
 * the client's local `YYYY-MM-DD`, at most 92 days apart.
 */
export async function recomputeAttendance(
  from: string,
  to: string,
): Promise<RecomputeResult> {
  // The server re-closes newest-first for a bounded time per call and says where it stopped — one
  // long call used to die inside the 15 s function and return a 5xx part-way (QA audit 2026-10-08,
  // WP-159). Keep calling from `resume_to` until it reaches `from`; the cap is a runaway guard.
  let recomputed = 0;
  let next = to;
  for (let call = 0; call < 40; call++) {
    const q = new URLSearchParams({ from, to: next });
    const res = await apiFetch<RecomputeResult>(`/v1/attendance/recompute?${q}`, {
      method: "POST",
    });
    recomputed += res.recomputed;
    if (res.done !== false || !res.resume_to) return { from, to, recomputed, done: true };
    next = res.resume_to;
  }
  return { from, to, recomputed, done: false };
}

/** The statuses an admin may set (`day_override::dto::resolve_status`) — never presence. */
export type OverrideStatus = "leave" | "excused" | "non_workday";

/**
 * `PUT /v1/attendance/user/{id}/day/{date}/override` — correct one person's day (needs
 * `AttendanceManage` → `attendance:edit`). It can only *excuse* a day — `leave`, `excused` or
 * `non_workday` — never mark anyone present. Every tracking mode (since 2026-10-17 — no leave
 * workflow reaches a day already past). The server records who set it in the audit log and
 * re-closes an already-closed day at once.
 */
export function overrideDay(
  userId: string,
  date: string,
  status: OverrideStatus,
  note?: string,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(
    `/v1/attendance/user/${encodeURIComponent(userId)}/day/${encodeURIComponent(date)}/override`,
    {
      method: "PUT",
      body: JSON.stringify(note ? { status, note } : { status }),
    },
  );
}

/** Mirrors `time-attendance::user_day::UserDayDetail` — one employee's day of clock-in/out + hours. */
export interface ApiUserDayDetail {
  user_id: string;
  date: string;
  /** Resolved status once the nightly close ran; absent while the day is still open (today). */
  status?: AttendanceStatus;
  late: boolean;
  /** An approved leave request covers this date — true even before the close cron runs, so the live
   *  "today" roster can show "On leave" on a day with no resolved status yet. */
  on_leave: boolean;
  /**
   * Minutes of approved **partial-day** leave ("permission") for this date, else 0.
   *
   * Orthogonal to `status` and to `on_leave`: someone can be present and on permission at once.
   * The server credits these minutes toward presence rather than making the day an absence.
   */
  permission_minutes: number;
  /** Epoch **ms** of the first timer start. Absent = didn't clock in. */
  clock_in?: number;
  /** Epoch **ms** of the last session's stop. Absent while a session is still running. */
  clock_out?: number;
  worked_minutes: number;
  /** A session is open (clocked in, not yet out) — clock_out is deliberately absent. */
  running: boolean;
  /**
   * Epoch **ms** the **currently open** session started (present only while `running`). Unlike
   * `clock_in` (the day's first start), this is the open session's own start, so a live "elapsed"
   * clock counts from it correctly even after a break + restart. Absent from an older server — the
   * caller falls back to `clock_in` for a single-session day.
   */
  running_since?: number;
  entry_count: number;
  /** The day's logon session (machine/both orgs): first/last seen signed in, awake minutes. */
  logon_first_seen?: number;
  logon_last_seen?: number;
  logon_minutes?: number;
  /** Signed in right now (seen within ~12 minutes). */
  logon_active?: boolean;
}

/**
 * `GET /v1/attendance/user/{id}?date=` — one employee's clock-in/out + worked hours for a day
 * (needs `AttendanceReadTeam`). Reads their `TIME#` sessions directly, so it works for **today** too:
 * `clock_in` = first timer start; `clock_out` = last stop, or absent while a timer is still running.
 */
/**
 * `GET /v1/attendance/roster?date=` — {@link getUserDay} for **everyone in the caller's reach**, in
 * one request (needs `AttendanceReadTeam`; org scope + `AttendanceReadOrg` for the whole tenant,
 * otherwise the caller's department). Replaces one request per person per poll (WP-193). `null`
 * when the server predates the route (404), so callers fall back to the per-person read.
 */
export async function getRosterDay(
  date: string,
): Promise<{ users: ApiUserDayDetail[]; truncated: boolean } | null> {
  const q = new URLSearchParams({ date });
  try {
    const res = await apiFetch<{
      date: string;
      users: ApiUserDayDetail[];
      truncated?: boolean;
    }>(`/v1/attendance/roster?${q}`);
    return { users: res.users, truncated: res.truncated === true };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function getUserDay(userId: string, date: string): Promise<ApiUserDayDetail> {
  const q = new URLSearchParams({ date });
  return apiFetch<ApiUserDayDetail>(
    `/v1/attendance/user/${encodeURIComponent(userId)}?${q}`,
  );
}
