"use client";

/**
 * Org attendance oversight for a **range**, on the live backend.
 *
 * The admin attendance page shows one number and one roster for a chosen window (Today / this week /
 * this month / a custom span / a single picked day), optionally narrowed to a department. There is no
 * range endpoint, so this hook assembles the window from the primitives that *are* real:
 *
 *  - **`today` (LIVE).** "Who is in *right now*" cannot come from attendance — the close cron only
 *    resolves days after midnight, so today has no attendance record yet. Instead it comes from the
 *    device fleet: an agent reporting `online`/`idle` == that person is at their machine now. So the
 *    denominator is the active directory and the numerator is distinct online device owners.
 *  - **past ranges (`day`/`week`/`month`/`custom`).** Fans `GET /v1/attendance/day` over the range's
 *    **closed** workdays (bounded concurrency 3, skip-on-failure, re-throw 403 — same discipline as
 *    `use-month-attendance`) and aggregates at the **user** level so a department filter is possible
 *    (the day summary is org-wide and can't be sliced by department).
 *
 * Nothing here is fabricated: `late` is always 0 (the oversight index carries no per-person late flag
 * — LLD §7), and today's "in/out" is genuine live presence, not a guess.
 */
import { useEffect, useMemo, useState } from "react";
import { getDayOversight } from "./services/attendance.service";
import {
  listEmployees,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import { listFleet } from "@/modules/agents/services/fleet.service";
import { monthMatrix, MONTH_NAMES } from "./lib/calendar";

export type AttendanceRange = "today" | "week" | "month" | "custom" | "day";

/** A calendar date with a **0-indexed** month (matches `lib/calendar`'s `TODAY`). */
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
}

export interface OversightCounts {
  present: number;
  /** Always 0 — the oversight index has no per-person late flag. Never fabricated. */
  late: number;
  leave: number;
  total: number;
}

export interface OversightAttendance {
  counts: OversightCounts;
  label: string;
  rows: OversightRow[];
  mode: OversightMode;
  /** Sorted distinct department names for the filter, with a leading `"all"`. */
  departments: string[];
  loading: boolean;
  error: string | null;
  /** Non-fatal degradation (e.g. today's live presence unavailable). */
  note: string | null;
}

const EMPTY_COUNTS: OversightCounts = { present: 0, late: 0, leave: 0, total: 0 };

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;

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

/** The **closed** workdays (ISO) a past range covers. `today`/future are never fetched (no record). */
function rangeDays(
  range: AttendanceRange,
  date: AttendanceDate,
  start: string,
  end: string,
  todayIso: string,
): string[] {
  if (range === "today") return [];
  if (range === "day") {
    const iso = isoOf(date.year, date.month, date.day);
    return iso < todayIso ? [iso] : [];
  }
  if (range === "week") {
    const t = new Date();
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t);
      d.setDate(t.getDate() - i);
      if (mondayIndex(d.getDay()) < 5) {
        const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
        if (iso < todayIso) out.push(iso);
      }
    }
    return out;
  }
  if (range === "month") {
    return monthMatrix(date.year, date.month)
      .flat()
      .filter((c) => c.inMonth && c.isWorkday)
      .map((c) => isoOf(c.year, c.month, c.day))
      .filter((iso) => iso < todayIso);
  }
  // custom
  if (!start || !end) return [];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const out: string[] = [];
  const d = new Date(s);
  let guard = 0;
  while (d.getTime() <= e.getTime() && guard < 400) {
    if (mondayIndex(d.getDay()) < 5) {
      const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
      if (iso < todayIso) out.push(iso);
    }
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
  if (range === "today") return "Today · live";
  if (range === "day") return prettyDate(date);
  if (range === "week") return "This week";
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

interface ComputedState {
  counts: OversightCounts;
  rows: OversightRow[];
  mode: OversightMode;
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
}: {
  range: AttendanceRange;
  dept: string;
  date: AttendanceDate;
  start: string;
  end: string;
}): OversightAttendance {
  // Directory (names + departments + active flag) — loaded once, reused by every range.
  const [dir, setDir] = useState<Map<string, DirEntry> | null>(null);
  const [departments, setDepartments] = useState<string[]>(["all"]);
  const [dirError, setDirError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [roster, depts] = await Promise.all([
          listEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;
        const m = new Map<string, DirEntry>();
        const names = new Set<string>();
        for (const e of roster) {
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
  }, []);

  const todayIso = useMemo(
    () => isoOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
    [],
  );
  const dayList = useMemo(
    () => rangeDays(range, date, start, end, todayIso),
    [range, date.year, date.month, date.day, start, end, todayIso],
  );
  const label = useMemo(
    () => rangeLabel(range, date, start, end),
    [range, date.year, date.month, date.day, start, end],
  );

  const [state, setState] = useState<ComputedState>({
    counts: EMPTY_COUNTS,
    rows: [],
    mode: "today",
    loading: true,
    error: null,
    note: null,
  });

  useEffect(() => {
    if (!dir) return; // wait for the directory
    let live = true;
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
              if (d.connectivity === "online" || d.connectivity === "idle")
                onlineIds.add(d.user_id);
            }
          } catch (e) {
            note = isForbidden(e)
              ? "Live presence needs device-fleet access — showing the directory only."
              : "Couldn't reach the device fleet — live presence is unavailable.";
          }
          if (!live) return;
          const rows: OversightRow[] = emp
            .map(([userId, e]) => ({
              userId,
              name: e.name,
              dept: e.dept,
              status: onlineIds.has(userId) ? "in" : "out",
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          const present = rows.filter((r) => r.status === "in").length;
          setState({
            counts: { present, late: 0, leave: 0, total: emp.length },
            rows,
            mode: "today",
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
        let leave = 0;
        let total = 0;
        const perUser = new Map<string, { present: number; counted: number }>();
        const singleDay: { userId: string; status: string }[] = [];

        for (const [, resp] of entries) {
          if (!resp) continue;
          for (const u of resp.users) {
            const entry = dir.get(u.user_id);
            const uDept = entry?.dept ?? "—";
            if (dept !== "all" && uDept !== dept) continue;
            if (range === "day") singleDay.push({ userId: u.user_id, status: u.status });
            if (u.status === "non_workday") continue; // excluded from every tally (§7)
            total += 1;
            const pu = perUser.get(u.user_id) ?? { present: 0, counted: 0 };
            pu.counted += 1;
            if (u.status === "present" || u.status === "partial") {
              present += 1;
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
          rows = singleDay
            .map(({ userId, status }) => {
              const entry = dir.get(userId);
              return {
                userId,
                name: entry?.name ?? "Unknown user",
                dept: entry?.dept ?? "—",
                status,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        } else {
          mode = "range";
          rows = [...perUser.entries()]
            .map(([userId, pu]) => {
              const entry = dir.get(userId);
              return {
                userId,
                name: entry?.name ?? "Unknown user",
                dept: entry?.dept ?? "—",
                daysPresent: pu.present,
                daysCounted: pu.counted,
                rate: pu.counted ? Math.round((pu.present / pu.counted) * 100) : 0,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        setState({
          counts: { present, late: 0, leave, total },
          rows,
          mode,
          loading: false,
          error: null,
          note:
            dayList.length === 0
              ? "No closed attendance days in this range yet — the 00:15 cron resolves each day after midnight."
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
  }, [dir, range, dept, dayList]);

  return {
    counts: state.counts,
    label,
    rows: state.rows,
    mode: state.mode,
    departments,
    loading: state.loading && !dirError,
    error: state.error ?? dirError,
    note: state.note,
  };
}
