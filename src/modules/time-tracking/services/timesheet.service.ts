/**
 * Timesheets — the real backend (`time-attendance` context, LLD §4).
 *
 * `component → module service → lib/api → HTTP`. This is the first read on the real seam, and the
 * pattern every other module service should copy.
 *
 * ## Where this deliberately differs from `lib/mock-time.ts`
 *
 * The mock was written before the backend existed and invented two fields the server does not
 * serve. They are **not** reproduced here, because a plausible-looking zero is worse than an
 * absence — it reads as a measurement:
 *
 * - **`activity` (0–100)**. The agent captures activity samples, but no built read joins them onto
 *   a time entry. There is no honest value to put here.
 * - **`task` (a title)**. Entries carry `task_id`. Titles live on the Task item, which the built
 *   reads cannot reach: `GET /v1/me/tasks` queries GSI1, whose projection is `INCLUDE
 *   ("type","status")` — no `title`. So `taskLabel` falls back to the id. Fixing it properly means
 *   either denormalising the title onto the entry at fold time or widening the GSI1 projection
 *   (an index rebuild); both are backend decisions, not something to paper over here.
 *
 * ## Time is milliseconds, and the day is the client's
 *
 * `start`/`end` are epoch **ms** (the agent's stamps). `duration_secs` is **seconds** and is absent
 * while a session runs — `undefined`, never `0`, so a running timer never reads as a zero-length
 * session. `date` is required by the server on purpose: the Lambda runs in UTC and cannot know the
 * user's timezone, so "today" is a question only the client can answer (see `todayLocal`).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `time_attendance::shared::entry::EntryRow`. Optional fields are `skip_serializing_if`. */
export interface ApiEntryRow {
  session_id: string;
  /** `YYYY-MM-DD` — the session's **start** day. A session crossing midnight is not split. */
  date: string;
  task_id: string;
  project_id: string;
  description?: string;
  /** Epoch ms. */
  start: number;
  /** Epoch ms. Absent while the session is still running. */
  end?: number;
  /** Seconds. Absent while running; never negative (clamped server-side). */
  duration_secs?: number;
  stop_reason?: string;
  /** Frozen at fold — reflects what the project was when the work happened. */
  billable: boolean;
  /** Always `agent`; there is no manual entry path (LLD §4). */
  source: string;
  /** The task was gone/unassigned at fold. The entry still counts — the time was really worked. */
  task_invalid?: boolean;
}

export interface ApiTodayResponse {
  date: string;
  entries: ApiEntryRow[];
  total_secs: number;
  billable_secs: number;
  /** A session is open. The web shows this read-only — it cannot start or stop it (LLD §4). */
  running: boolean;
}

export interface ApiDayRow {
  date: string;
  total_secs: number;
  billable_secs: number;
  entries: ApiEntryRow[];
}

export interface ApiGridResponse {
  from: string;
  to: string;
  days: ApiDayRow[];
  total_secs: number;
  billable_secs: number;
}

/**
 * The client's own calendar date as `YYYY-MM-DD`.
 *
 * Built from the local components, **not** `toISOString()` — that converts to UTC first, which
 * hands back yesterday's date for anyone east of Greenwich in the small hours. That is exactly the
 * bug the server refuses to guess at, so reintroducing it here would defeat the point.
 */
export function todayLocal(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `GET /v1/me/timesheet/today?date=` — the caller's own day. */
export function getToday(date: string): Promise<ApiTodayResponse> {
  return apiFetch<ApiTodayResponse>(
    `/v1/me/timesheet/today?date=${encodeURIComponent(date)}`,
  );
}

/**
 * `GET /v1/me/timesheet?from&to` — days rolled up server-side.
 *
 * The server caps the span at 92 days and 400s anything longer (that is the export job's work), so
 * callers must not widen this into a year picker without going through the export path.
 */
export function getRange(from: string, to: string): Promise<ApiGridResponse> {
  const q = new URLSearchParams({ from, to });
  return apiFetch<ApiGridResponse>(`/v1/me/timesheet?${q}`);
}

/**
 * `GET /v1/timesheet/user/{id}?from&to` — another employee's rolled-up days, for the team oversight
 * grid. Gated `TimeReadTeam` server-side: a caller without it gets a **403**, which the team hook
 * turns into an honest "no team time access" state rather than an empty grid. Same `GridResponse`
 * shape as {@link getRange} (the caller's own `/v1/me/timesheet`); the same 92-day cap applies.
 */
export function getUserTimesheet(
  userId: string,
  from: string,
  to: string,
): Promise<ApiGridResponse> {
  const q = new URLSearchParams({ from, to });
  return apiFetch<ApiGridResponse>(
    `/v1/timesheet/user/${encodeURIComponent(userId)}?${q}`,
  );
}

/** Epoch ms → local `HH:MM`, matching how the entry's own day was resolved. */
export function clockOf(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * What a timesheet row should call its task.
 *
 * `description` when the fold recorded one, else the raw `task_id`. The id is deliberate: it is
 * true, and an obviously-technical string invites the question "why isn't there a title here?" —
 * which is the actual state of the backend. See the module docs.
 */
export function taskLabel(e: ApiEntryRow): string {
  return e.description?.trim() || e.task_id;
}
