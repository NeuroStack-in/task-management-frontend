"use client";

/**
 * Org attendance oversight for a **range**, on the live backend.
 *
 * The admin attendance page shows one number and one roster for a chosen window (Today / this week /
 * this month / a custom span / a single picked day), optionally narrowed to a department. There is no
 * range endpoint, so this hook assembles the window from the primitives that *are* real:
 *
 *  - **`today` (LIVE).** "Who is in *right now*" cannot come from attendance — the nightly close
 *    resolves a day only at its end (23:59, org time), so today has no attendance record yet. It is
 *    read per person from `GET /v1/attendance/user/{id}` (timer or logon sessions, approved leave)
 *    and classified here against the org's schedule and holidays, the same rules the close applies.
 *  - **past ranges (`day`/`week`/`month`/`custom`).** Fans `GET /v1/attendance/day` over **every
 *    closed day** in the range (bounded concurrency 3, skip-on-failure, re-throw 403 — same
 *    discipline as `use-month-attendance`) and aggregates at the **user** level so a department
 *    filter is possible (the day summary is org-wide and can't be sliced by department). Days off
 *    are fetched too: someone who works one is `present` server-side and must count here.
 *
 * Nothing here is fabricated: `late` is always 0 (the oversight index carries no per-person late flag
 * — LLD §7), and today's "in/out" is genuine live presence, not a guess.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDayOversight,
  getUserDay,
  type ApiDayUser,
} from "./services/attendance.service";
import {
  listAllEmployees,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import { listFleet } from "@/modules/agents/services/fleet.service";
import { effectiveUserId, isPresent } from "@/modules/agents/lib/presence";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import { daysInMonth, MONTH_NAMES, type CalendarDay } from "./lib/calendar";
import { useWorkdays, useWorkingHours } from "@/hooks/use-working-hours";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { isWorkday } from "@/lib/workdays";
import { hasPermissionBit } from "@/lib/permission-bits";
import { useAuthStore } from "@/stores/auth.store";
import { attendanceRate } from "./lib/attended";
import { isoOfDay, useToday } from "./use-today";

/** `AttendanceReadOrg` in wp-contracts — the bit that lets a reader past their own department. */
const ATTENDANCE_READ_ORG_BIT = 35;

export type AttendanceRange = "today" | "week" | "month" | "custom" | "day";

/** A calendar date with a **0-indexed** month (the shape of `lib/calendar`'s `CalendarDay`). */
export interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

/** How the returned `rows` should be read. */
export type OversightMode = "today" | "day" | "range";

export interface OversightRow {
  userId: string;
  name: string;
  dept: string;
  /** `today`/`day` mode: a status string — `present|partial|absent|leave|non_workday`, or `in|out`. */
  status?: string;
  /** `range` mode: workdays the person was present (present|partial) across the window. */
  daysPresent?: number;
  /** `range` mode: workdays that counted (everything but non_workday). */
  daysCounted?: number;
  /** `range` mode: `daysPresent / daysCounted` as a 0–100 percentage. */
  rate?: number;
  // ── day / today mode: clock-in/out + hours, from the per-user timesheet endpoint ──
  /** Epoch **ms** of the first timer start. Absent = didn't clock in (renders `—`). */
  clockIn?: number;
  /** Epoch **ms** of the last stop. Absent while a timer is still running or no session (renders `—`). */
  clockOut?: number;
  /** Worked minutes for the day (→ hours in the UI). While a timer runs: completed sessions only. */
  workedMinutes?: number;
  /** A timer is on right now (clocked in, no clock-out). */
  running?: boolean;
  /**
   * Epoch **ms** the currently open session started — so a running row ticks as
   * `workedMinutes + (now − runningSince)`, exact after a break and a restart too. Absent from an
   * older server, where only a single-session day can tick (from `clockIn`).
   */
  runningSince?: number;
  /** Number of timer sessions today — lets a single-session running row tick live from `clockIn`
   *  (which is then the open session's own start) without over-counting a break. */
  entryCount?: number;
  /**
   * `today` mode: this person's day could not be read (a throttled or failed call). Their row keeps
   * the live device presence, but no attendance verdict is guessed and they are left out of the
   * counts — a failed read is not an absence (QA audit 2026-10-08, WP-253).
   */
  dayUnknown?: boolean;
  /** An approved leave request covers this date (`day`/`today` mode). */
  onLeave?: boolean;
  /**
   * Minutes of approved partial-day leave ("permission") on this date, else 0/undefined.
   *
   * **Not a status.** Someone on permission still worked the rest of the day, so this rides
   * alongside `status`/`todayStatus` rather than replacing either — the same separation the server
   * keeps between `permission_minutes` and `on_leave`.
   */
  permissionMinutes?: number;
  /**
   * `today` mode only — a live attendance read derived here, since today has no closed verdict. The
   * same rules the nightly close applies (`shared::attendance::resolve`):
   *  - `leave`   — an approved leave covers today
   *  - `off`     — not expected today: an org holiday, or an unscheduled day nobody worked
   *  - `absent`  — a scheduled day with no session and no approved leave
   *  - `late`    — clocked in on a scheduled day after the org's "Late after" time
   *  - `present` — clocked in (on time, or on a day off they chose to work)
   *
   * Absent (`undefined`) for a `dayUnknown` row.
   */
  todayStatus?: "leave" | "off" | "absent" | "late" | "present";
}

export interface OversightCounts {
  /** Fully present only. **Not** the attendance figure — see `lib/attended`. */
  present: number;
  /**
   * Partially present, kept separate rather than folded into `present`.
   *
   * It used to be folded here, which made the overview count it as attendance while the calendar
   * counted it as absence — the same day reading 38% and 31%. Surfaces now share one definition
   * (`attended()`) and can still show this band on its own.
   */
  partial: number;
  /** Always 0 — the oversight index has no per-person late flag. Never fabricated. */
  late: number;
  leave: number;
  total: number;
}

/** One closed workday's attendance distribution — the unit of the trend series. */
export interface DayPoint {
  iso: string;
  /** Fully present only. */
  present: number;
  /** Partially present — attended, but shown as its own band. */
  partial: number;
  leave: number;
  absent: number;
  total: number;
  /** Attendance (present + partial) over `total`, as a 0–100 percentage. */
  rate: number;
}

export interface OversightAttendance {
  counts: OversightCounts;
  label: string;
  rows: OversightRow[];
  mode: OversightMode;
  /** Per closed workday in the range, chronological. Empty for `today`/single `day`; drives the trend. */
  series: DayPoint[];
  /** A comparison baseline (0–100): for `today`, the trailing-workday average; for a multi-day range,
   *  the range's own mean daily rate. `null` when there is nothing to compare against. */
  benchmarkRate: number | null;
  /** Sorted distinct department names for the filter, with a leading `"all"`. */
  departments: string[];
  loading: boolean;
  error: string | null;
  /** Non-fatal degradation (e.g. today's live presence unavailable). */
  note: string | null;
  /** Manual refetch of the active range (for a Refresh button). Does not start a poll. */
  reload: () => void;
  /**
   * Tally one day's `GET /v1/attendance/day` users over **this page's population** — the directory
   * (people who can run a timer, not benched, in reach) and the department filter. The month
   * calendar uses it so a cell agrees with the overview and the trend: the server's own `summary`
   * counts everyone in reach, Owner and Admin included, across every department (QA audit
   * 2026-10-08, WP-256). `null` until the directory has loaded.
   */
  summarizeDay: ((iso: string, users: ApiDayUser[]) => DayPoint) | null;
  /** Today is not a working day for the org — a holiday, or outside its scheduled weekdays. */
  todayOff: boolean;
}

const EMPTY_COUNTS: OversightCounts = {
  present: 0,
  partial: 0,
  late: 0,
  leave: 0,
  total: 0,
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  void y;
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
};
const prettyDate = (d: AttendanceDate) =>
  `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}, ${d.year}`;

function isForbidden(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 403
  );
}

/** Run `fn` over `items` with at most `limit` in flight (fan-out throttle guard). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

/**
 * Enrich per-person rows (day / today mode) with clock-in/out + worked minutes from the per-user
 * timesheet endpoint. One call per row, bounded to 4 in flight.
 *
 * `today` also re-derives in/out from the same response, and decides what a failed read means —
 * it used to be left unenriched and then classified "Absent" for having no clock-in (QA audit
 * 2026-10-08, WP-253):
 *  - **403** — the person is outside the caller's reach (a team-scoped reader, another department).
 *    The row is dropped: not this reader's team, so neither "Absent" nor in the denominator.
 *  - **anything else** (a throttled burst, a 5xx, the network) — the row keeps its live device
 *    presence and is marked `dayUnknown`: no verdict is guessed and it is not counted.
 * A past `day` keeps every row: its status came from the day endpoint, only the clock columns are
 * missing (rendered `—`).
 *
 * **Why status is decided here and not by the caller.** Today's in/out used to come from the device
 * fleet while these columns came from the timesheet — two independent signals that routinely
 * disagreed. Someone with their laptop on but no timer running read as "In now" with `—` for every
 * clock column, and someone who had clocked out at 21:06 still read as "In now" *with* a clock-out
 * time. Deciding both from one response makes them consistent by construction: a row can no longer
 * claim someone is working while showing the moment they stopped.
 */
async function enrichClock(
  rows: OversightRow[],
  iso: string,
  today = false,
): Promise<{ rows: OversightRow[]; forbidden: number }> {
  const details = await mapWithConcurrency(rows, 4, (r) =>
    getUserDay(r.userId, iso).then(
      (d) => ({ d, denied: false }),
      (e: unknown) => ({ d: null, denied: isForbidden(e) }),
    ),
  );
  let forbidden = 0;
  const out: OversightRow[] = [];
  rows.forEach((r, i) => {
    const { d, denied } = details[i];
    if (!d) {
      if (today && denied) {
        forbidden += 1;
        return;
      }
      out.push(today ? { ...r, dayUnknown: true } : r);
      return;
    }
    // No timer session, but a logon session: a machine/both org, where presence is a Windows
    // sign-in. Reading only the timer made every such employee "Out"/"Absent" (WP-077), so the
    // logon facts stand in — first sign-in as clock-in, signed in now as running.
    const byLogon = d.clock_in == null && !d.running && d.logon_first_seen != null;
    const clockIn = byLogon ? d.logon_first_seen : d.clock_in;
    const running = byLogon ? Boolean(d.logon_active) : d.running;
    const clockOut = byLogon ? (running ? undefined : d.logon_last_seen) : d.clock_out;
    out.push({
      ...r,
      clockIn,
      clockOut,
      workedMinutes: byLogon ? (d.logon_minutes ?? 0) : d.worked_minutes,
      running,
      runningSince: byLogon ? undefined : d.running_since,
      entryCount: d.entry_count,
      onLeave: d.on_leave,
      permissionMinutes: d.permission_minutes,
      ...(today ? { status: running ? "in" : "out" } : {}),
    });
  });
  return { rows: out, forbidden };
}

/** Epoch ms → local `HH:MM` (24h, zero-padded), so it compares lexically against a `late_threshold`. */
function localHHMM(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** What today is for the org: one of its scheduled weekdays, and/or a configured holiday. */
export interface TodayKind {
  scheduled: boolean;
  holiday: boolean;
}

/**
 * Classify a person's **today** attendance from live signals (today has no closed verdict yet), in
 * the order the nightly close resolves a day (`shared::attendance::resolve`): leave → holiday →
 * no session (absent on a scheduled day, off otherwise) → late vs on time.
 *
 * It used to know nothing about the schedule, so on a Saturday or a holiday everyone without a
 * session read "Absent", the headline said 0 %, and a volunteer starting at 11:00 was "Late" — the
 * opposite of what the close stamps that night (QA audit 2026-10-08, WP-254). Exported for tests.
 */
export function classifyToday(
  r: OversightRow,
  lateThreshold: string,
  day: TodayKind,
): OversightRow["todayStatus"] {
  if (r.dayUnknown) return undefined;
  if (r.onLeave) return "leave";
  // A configured holiday is a non-working day even if a timer ran — the close stamps it so.
  if (day.holiday) return "off";
  const worked = r.clockIn != null || Boolean(r.running);
  // No session at all: absent only on a day they were expected.
  if (!worked) return day.scheduled ? "absent" : "off";
  // Lateness is measured against an expected start, so only a scheduled day can be late.
  if (day.scheduled && r.clockIn != null && localHHMM(r.clockIn) > lateThreshold) return "late";
  return "present";
}

/**
 * The **closed** days (ISO) a past range covers. Today and the future are never fetched (no record).
 *
 * Every day, not just the org's scheduled ones: the close resolves an off day that somebody worked
 * as `present` and counts it, and filtering by the schedule first made that day — and its hours —
 * vanish from every range (QA audit 2026-10-08, WP-260). An off day nobody worked comes back as all
 * `non_workday`, which counts toward nothing and is dropped from the trend. Exported for tests.
 */
export function rangeDays(
  range: AttendanceRange,
  date: AttendanceDate,
  start: string,
  end: string,
  now: CalendarDay,
): string[] {
  const todayIso = isoOfDay(now);
  if (range === "today") return [];
  if (range === "day") {
    const iso = isoOf(date.year, date.month, date.day);
    return iso < todayIso ? [iso] : [];
  }
  if (range === "week") {
    // The seven days before today — every one of them closed.
    const out: string[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date(now.year, now.month, now.day - i);
      out.push(isoOf(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return out;
  }
  if (range === "month") {
    const out: string[] = [];
    for (let d = 1; d <= daysInMonth(date.year, date.month); d++) {
      const iso = isoOf(date.year, date.month, d);
      if (iso < todayIso) out.push(iso);
    }
    return out;
  }
  // custom
  if (!start || !end) return [];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const out: string[] = [];
  const d = new Date(s);
  let guard = 0;
  while (d.getTime() <= e.getTime() && guard < 400) {
    const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
    if (iso < todayIso) out.push(iso);
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

function rangeLabel(
  range: AttendanceRange,
  date: AttendanceDate,
  start: string,
  end: string,
): string {
  if (range === "today") return "Today";
  if (range === "day") return prettyDate(date);
  // The seven days before today, not the calendar week — on a Monday "This week" was entirely
  // last week (QA audit 2026-10-08, WP-475).
  if (range === "week") return "Last 7 days";
  if (range === "month") return `${MONTH_NAMES[date.month]} ${date.year}`;
  if (range === "custom")
    return start && end ? `${shortDate(start)} – ${shortDate(end)}` : "Custom range";
  return "";
}

interface DirEntry {
  name: string;
  dept: string;
  active: boolean;
}

/**
 * Statuses that count toward nothing: a day off (§7), and an admin-excused day — the server's own
 * summaries leave `excused` out of `counted`, and folding it into "absent" here made one excused
 * Tuesday an absence on the overview, the trend and the per-person rate (QA audit 2026-10-08,
 * WP-257).
 */
const isUncounted = (status: string) => status === "non_workday" || status === "excused";

/** A day's oversight users → one `DayPoint`, applying the department filter. Uncounted statuses
 *  are excluded from every tally; anything else that isn't present/partial/leave is absent.
 *  Exported for tests. */
export function dayPoint(
  iso: string,
  users: { user_id: string; status: string }[],
  dir: Map<string, { name: string; dept: string; active: boolean }>,
  dept: string,
): DayPoint {
  let present = 0;
  let partial = 0;
  let leave = 0;
  let absent = 0;
  let total = 0;
  for (const u of users) {
    const entry = dir.get(u.user_id);
    // Same population rule as the main tally below: someone absent from the directory is not
    // attendance-tracked, so they must not land in this series as an absent day either.
    if (!entry) continue;
    if (dept !== "all" && entry.dept !== dept) continue;
    if (isUncounted(u.status)) continue;
    total += 1;
    if (u.status === "present") present += 1;
    else if (u.status === "partial") partial += 1;
    else if (u.status === "leave") leave += 1;
    else absent += 1;
  }
  return {
    iso,
    present,
    partial,
    leave,
    absent,
    total,
    // The one definition — partial counts as attended (lib/attended).
    rate: attendanceRate({ present, partial }, total),
  };
}

interface ComputedState {
  counts: OversightCounts;
  rows: OversightRow[];
  mode: OversightMode;
  series: DayPoint[];
  benchmarkRate: number | null;
  loading: boolean;
  error: string | null;
  note: string | null;
}

export function useOversightAttendance({
  range,
  dept,
  date,
  start,
  end,
  enabled = true,
}: {
  range: AttendanceRange;
  dept: string;
  date: AttendanceDate;
  start: string;
  end: string;
  /**
   * `false` = fetch nothing (and report not-loading). The page's always-"today" header instance is
   * switched off while the body is itself on Today — two identical instances doubled every request:
   * the directory, the fleet and one `getUserDay` per employee (QA audit 2026-10-08, WP-272).
   */
  enabled?: boolean;
}): OversightAttendance {
  // Directory (names + departments + active flag) — loaded once, reused by every range.
  const [dir, setDir] = useState<Map<string, DirEntry> | null>(null);
  const [departments, setDepartments] = useState<string[]>(["all"]);
  const [dirError, setDirError] = useState<string | null>(null);
  // Manual refetch for a Refresh button. A bare counter, deliberately **not** `useLiveRefresh`: this
  // adds an on-demand refresh without also starting a 30 s poll on a page that never polled (which
  // would quietly add request load). The value is a dep of the fetch effect below.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Loaded once per mount, but only once this instance is actually wanted.
  const dirDone = useRef(false);
  useEffect(() => {
    if (!enabled || dirDone.current) return;
    let live = true;
    (async () => {
      try {
        const [roster, depts, contributors] = await Promise.all([
          listAllEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
          // A failed roles read must not empty the roster — fall back to including everyone.
          contributorRoleIds().catch(() => null),
        ]);
        if (!live) return;
        // **Only the people the caller can reach.** `AttendanceReadOrg` (or the owner) reads anyone;
        // `AttendanceReadTeam` alone reads only the caller's own department, and every per-person
        // read outside it is a 403. The directory itself is org-wide, so a team lead's roster used
        // to list the whole org — everyone outside their department as "Absent", in the
        // denominator (QA audit 2026-10-08, WP-253). No `perm` claim (an old session) or no
        // department on file is no verdict: keep everyone and let a per-person 403 drop the row.
        const me = useAuthStore.getState().user;
        const orgWide =
          Boolean(me?.isOwner) ||
          hasPermissionBit(me?.perm, ATTENDANCE_READ_ORG_BIT) !== false;
        const myDept = roster.find((e) => e.user_id === me?.id)?.department_id;
        const reachDept = orgWide ? null : myDept || null;
        const m = new Map<string, DirEntry>();
        const names = new Set<string>();
        for (const e of roster) {
          // Benched employees are excluded from Attendance entirely — not shown as absent/out.
          if (e.benched) continue;
          if (reachDept !== null && e.department_id !== reachDept) continue;
          // Skip anyone who cannot run a timer. §7 resolves "a scheduled workday with no timer
          // session and no approved leave" to **absent**, so an Owner/Admin — who hold no
          // `TimeTrackSelf` by construction — would be marked absent every working day and pull the
          // org attendance rate down with them. Keyed on the permission, not `is_owner`: see
          // `contributorRoleIds`.
          if (contributors !== null && e.role_id && !contributors.has(e.role_id))
            continue;
          const dName = depts.get(e.department_id) ?? "—";
          m.set(e.user_id, {
            name: e.name,
            dept: dName,
            active: e.status === "active",
          });
          if (dName && dName !== "—") names.add(dName);
        }
        setDir(m);
        setDepartments(["all", ...[...names].sort()]);
        setDirError(null);
        dirDone.current = true;
      } catch (e) {
        if (live)
          setDirError(
            isForbidden(e)
              ? "You don't have access to team attendance."
              : "Couldn't load the employee directory.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled]);

  // The real today, re-read at midnight — a tab left open overnight must not keep querying the day
  // it was opened on (QA audit 2026-10-08, WP-258).
  const now = useToday();
  const todayIso = isoOfDay(now);
  const workdays = useWorkdays();
  const holidays = useOrgHolidays();
  // "Late after" for the live today classification. Defaults to the same 09:30 the server assumes for
  // an unconfigured org, so a slow/failed settings read still classifies sensibly.
  const lateThreshold = useWorkingHours()?.late_threshold ?? "09:30";
  const todayKind = useMemo<TodayKind>(
    () => ({
      scheduled: isWorkday(new Date(now.year, now.month, now.day), workdays),
      holiday: holidays.isHoliday(todayIso),
    }),
    [now, workdays, holidays, todayIso],
  );
  // Primitives, so the memos below key on the date's value rather than the object's identity.
  const { year, month, day } = date;
  // The fetch keys on the days' **content**, not the array: `rangeDays` returns a fresh array every
  // time its inputs change, so the header's Today instance (always `[]`) re-ran its whole fan-out on
  // every date the user picked below it (WP-272).
  const dayKey = useMemo(
    () => rangeDays(range, { year, month, day }, start, end, now).join(","),
    [range, year, month, day, start, end, now],
  );
  const label = useMemo(
    () => rangeLabel(range, { year, month, day }, start, end),
    [range, year, month, day, start, end],
  );

  const [state, setState] = useState<ComputedState>({
    counts: EMPTY_COUNTS,
    rows: [],
    mode: "today",
    series: [],
    benchmarkRate: null,
    loading: true,
    error: null,
    note: null,
  });

  useEffect(() => {
    if (!enabled || !dir) return; // switched off, or waiting for the directory
    let live = true;
    const dayList = dayKey ? dayKey.split(",") : [];
    setState((s) => ({ ...s, loading: true, error: null, note: null }));

    (async () => {
      try {
        // ── Today: live presence from the device fleet ────────────────────────────────────────
        if (range === "today") {
          const emp = [...dir.entries()].filter(
            ([, e]) => e.active && (dept === "all" || e.dept === dept),
          );
          const onlineIds = new Set<string>();
          let note: string | null = null;
          try {
            const fleet = await listFleet();
            for (const d of fleet.devices) {
              // Presence, not raw connectivity: a managed machine heartbeats from boot with nobody
              // signed in (would falsely read "in"), and a slept laptop reads offline mid-shift.
              // `presenceOf` handles both; `effectiveUserId` covers a managed device's empty
              // `user_id` (MANAGED-AGENT.md §8 Ph2). A missed one is a silently wrong headcount.
              const uid = effectiveUserId(d);
              if (uid && isPresent(d)) onlineIds.add(uid);
            }
          } catch (e) {
            note = isForbidden(e)
              ? "Live presence needs device-fleet access — showing the directory only."
              : "Couldn't reach the device fleet — live presence is unavailable.";
          }
          if (!live) return;
          const baseRows: OversightRow[] = emp
            .map(([userId, e]) => ({
              userId,
              name: e.name,
              dept: e.dept,
              status: onlineIds.has(userId) ? "in" : "out",
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          // Clock-in/out for today comes from each person's live TIME# sessions — and so does the
          // in/out status now. The fleet-derived status above survives only as the fallback for a
          // row whose timesheet call failed.
          const { rows, forbidden } = await enrichClock(baseRows, todayIso, true);
          if (!live) return;
          // Every read refused is the caller's access, not N people out of their reach.
          if (rows.length === 0 && forbidden > 0) {
            setState({
              counts: EMPTY_COUNTS,
              rows: [],
              mode: "today",
              series: [],
              benchmarkRate: null,
              loading: false,
              error: "You don't have access to team attendance.",
              note: null,
            });
            return;
          }
          // The verdicts and counts are derived from these rows below (`todayView`), outside the
          // fetch: the schedule, holidays and "Late after" all load asynchronously, and keying the
          // fetch on them re-read every person's day when settings arrived.
          setState({
            counts: EMPTY_COUNTS,
            rows,
            mode: "today",
            series: [],
            // No honest "vs recent" delta for Today: the live clocked-in-now snapshot isn't the same
            // metric as a trailing full-day average, so comparing them read as "attendance down" on a
            // normal morning. The multi-day view keeps its own (like-for-like) average line.
            benchmarkRate: null,
            loading: false,
            error: null,
            note,
          });
          return;
        }

        // ── Past ranges: fan the day endpoint over the closed workdays ─────────────────────────
        const entries = await mapWithConcurrency(dayList, 3, (iso) =>
          getDayOversight(iso).then(
            (resp) => [iso, resp] as const,
            (e) => {
              if (isForbidden(e)) throw e; // a 403 is the whole range's, not one day's
              return [iso, null] as const;
            },
          ),
        );
        if (!live) return;

        let present = 0;
        let partial = 0;
        let leave = 0;
        let total = 0;
        const perUser = new Map<
          string,
          { present: number; counted: number; name: string; dept: string }
        >();
        const singleDay: OversightRow[] = [];

        for (const [, resp] of entries) {
          if (!resp) continue;
          for (const u of resp.users) {
            const entry = dir.get(u.user_id);
            // **Not in the directory ⇒ not part of the attendance population.** The directory build
            // above deliberately drops anyone who cannot run a timer — an Owner/Admin holds no
            // `TimeTrackSelf` — precisely so §7 does not mark them absent every workday. But that
            // exclusion only removed them from `dir`; the backend still returns a row per person
            // per day, so they arrived here nameless and were counted as absent *and* rendered as
            // "Unknown user". The population is decided here, so decide it here.
            if (!entry) continue;
            const uDept = entry.dept;
            if (dept !== "all" && uDept !== dept) continue;
            if (range === "day")
              singleDay.push({
                userId: u.user_id,
                name: entry.name,
                dept: uDept,
                status: u.status,
              });
            if (isUncounted(u.status)) continue; // a day off / an excused day counts toward nothing
            total += 1;
            const pu = perUser.get(u.user_id) ?? {
              present: 0,
              counted: 0,
              name: entry.name,
              dept: uDept,
            };
            pu.counted += 1;
            if (u.status === "present" || u.status === "partial") {
              // `pu.present` drives the per-person rate, where partial still counts as attended
              // (lib/attended) — only the headline bands are split.
              if (u.status === "present") present += 1;
              else partial += 1;
              pu.present += 1;
            } else if (u.status === "leave") {
              leave += 1;
            }
            perUser.set(u.user_id, pu);
          }
        }

        let rows: OversightRow[];
        let mode: OversightMode;
        if (range === "day") {
          mode = "day";
          const dayRows = [...singleDay].sort((a, b) => a.name.localeCompare(b.name));
          // Clock-in/out + hours for the picked day, per employee. `dayList` is that one day (or
          // empty for today/the future, where there are no rows to enrich).
          rows = (await enrichClock(dayRows, dayList[0] ?? "")).rows;
          if (!live) return;
        } else {
          mode = "range";
          rows = [...perUser.entries()]
            .map(([userId, pu]) => ({
              userId,
              name: pu.name,
              dept: pu.dept,
              daysPresent: pu.present,
              daysCounted: pu.counted,
              rate: pu.counted ? Math.round((pu.present / pu.counted) * 100) : 0,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        // Per-day trend from the days already fetched above — no extra requests. The benchmark line is
        // the range's own mean daily rate. A day nobody was expected (a weekend nobody worked, a
        // holiday) has no rate at all, so it is left out rather than drawn as a 0 % bar.
        const series: DayPoint[] = [];
        for (const [iso, resp] of entries) {
          if (!resp) continue;
          const point = dayPoint(iso, resp.users, dir, dept);
          if (point.total > 0) series.push(point);
        }
        series.sort((a, b) => a.iso.localeCompare(b.iso));
        const benchmarkRate = series.length
          ? Math.round(series.reduce((s, p) => s + p.rate, 0) / series.length)
          : null;

        setState({
          counts: { present, partial, late: 0, leave, total },
          rows,
          mode,
          series,
          benchmarkRate,
          loading: false,
          error: null,
          note:
            dayList.length === 0
              ? "No closed attendance days in this range yet — each day closes at 23:59 in the organization's timezone."
              : null,
        });
      } catch (e) {
        if (live)
          setState((s) => ({
            ...s,
            loading: false,
            error: isForbidden(e)
              ? "You don't have access to team attendance."
              : "Couldn't load attendance for this range. Retry.",
          }));
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, dir, range, dept, dayKey, todayIso, nonce]);

  // Today's verdicts and counts, from the fetched rows. Derived here rather than in the fetch so a
  // schedule, holiday list or "Late after" that loads late re-labels the roster without re-reading it.
  const todayView = useMemo(() => {
    if (state.mode !== "today") return null;
    const rows = state.rows.map((r) => ({
      ...r,
      todayStatus: classifyToday(r, lateThreshold, todayKind),
    }));
    // **Attended today, not clocked in right now.**
    //
    // This once counted `status === "in"` — a timer running at this instant — so the moment someone
    // stopped for the day the org's attendance fell back toward 0%. `late` still means they clocked
    // in, so both count as present — what every other range means by the word.
    //
    // The denominator is the people **expected** today: `off` (a holiday, or a day off nobody
    // worked) and an unread day are in neither half. `partial: 0` — partial is a verdict the close
    // assigns tonight; `leave` IS known today (approved leave), so it is counted.
    const counted = rows.filter((r) => r.todayStatus !== undefined && r.todayStatus !== "off");
    const counts: OversightCounts = {
      present: counted.filter((r) => r.todayStatus === "present" || r.todayStatus === "late")
        .length,
      partial: 0,
      late: 0,
      leave: counted.filter((r) => r.todayStatus === "leave").length,
      total: counted.length,
    };
    const unknown = rows.filter((r) => r.dayUnknown).length;
    const unknownNote =
      unknown > 0
        ? `Couldn't read today's record for ${unknown} ${unknown === 1 ? "person" : "people"} — they aren't counted. Refresh to try again.`
        : null;
    // A holiday has its own banner on the page; an ordinary day off says why nobody is absent.
    const offNote =
      !todayKind.scheduled && !todayKind.holiday
        ? "Today isn't one of the organization's working days — nobody is marked absent, and anyone who works counts as present."
        : null;
    const note = [state.note, offNote, unknownNote].filter(Boolean).join(" ") || null;
    return { rows, counts, note };
  }, [state.mode, state.rows, state.note, lateThreshold, todayKind]);

  const summarizeDay = useMemo(
    () =>
      dir ? (iso: string, users: ApiDayUser[]) => dayPoint(iso, users, dir, dept) : null,
    [dir, dept],
  );

  return {
    counts: todayView ? todayView.counts : state.counts,
    label,
    rows: todayView ? todayView.rows : state.rows,
    mode: state.mode,
    series: state.series,
    benchmarkRate: state.benchmarkRate,
    departments,
    loading: enabled && state.loading && !dirError,
    error: state.error ?? dirError,
    note: todayView ? todayView.note : state.note,
    reload,
    summarizeDay,
    todayOff: todayKind.holiday || !todayKind.scheduled,
  };
}
