"use client";

/**
 * Team timesheet oversight, assembled from real per-user reads.
 *
 * There is no single org-wide timesheet endpoint. So this hook fans out over the employee directory
 * and, per **active** employee, reads both:
 *   - `GET /v1/timesheet/user/{id}?from&to` (gated `TimeReadTeam`) → the same `GridResponse` as the
 *     caller's own `/v1/me/timesheet`; and
 *   - `GET /v1/insights/user/{id}/activity?from&to` (gated `activity:read`) → `trend.avg_score` for
 *     the activity %.
 * from those it derives the three view models the ported preview grid consumes.
 *
 * Safety, copied from `use-month-attendance`:
 *  - **Bounded concurrency (4)** — never fire N employee×2 requests at once (the fan-out throttle
 *    hazard this project already hit); `apiFetch` retries transient 503/429 on its own.
 *  - **Skip-on-failure** — one employee whose timesheet errors (non-403) drops out; the rest load.
 *    A single bad row must never blank the whole team.
 *  - **Reach first, then 403s per person** — a department-scoped reader is only asked about their
 *    own department, and a 403 drops that one row. Only when every read is refused is it surfaced
 *    as an access error, not a silently empty grid.
 *
 * Everything is honest-or-absent: no fabricated hours. Activity is `0` when the agent hasn't scored
 * (`days_scored === 0`), tracked hours are exactly what the grid returns, idle has no real source
 * (0), and a row is only `flagged` when we have **real** activity below 50 on someone who tracked
 * time — never as a side effect of missing agent data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listAllEmployees,
  departmentMap,
  UNASSIGNED_DEPT,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import { formatDateRange, UNKNOWN_DEPARTMENT, UNKNOWN_PROJECT } from "@/lib/format";
import { listProjects } from "@/modules/projects/services/projects.service";
import { getUserActivity } from "@/modules/insights/services/insights.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import {
  clockOf,
  getUserTimesheet,
  type ApiGridResponse,
} from "./services/timesheet.service";
import type {
  ProjectTimesheet,
  TeamMemberTime,
  TimesheetDayEntry,
  TimesheetStatus,
} from "./types";
import { useAuthStore } from "@/stores/auth.store";
import { hasPermissionBit, TIME_READ_ORG_BIT } from "@/lib/permission-bits";

/** Run `fn` over `items` with at most `limit` in flight. Mirrors `use-month-attendance`. */
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

function isForbidden(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 403
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Local `YYYY-MM-DD` (not `toISOString()`, which shifts to UTC and can hand back yesterday). */
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/**
 * Hours as they are — **not** rounded. These were rounded to one decimal (6-minute steps) and
 * then shown, summed and exported as `HH:MM:SS`, so every cell was a multiple of 00:06:00, a
 * day under 3 minutes read as untracked, and totals did not equal their parts (WP-056). The
 * formatters round to the second when they display.
 */
const exactHours = (n: number) => n;

/**
 * Mon–Sun of the week `offset` weeks from the one containing `now` (local).
 * `0` = this week, `-1` = last week. Returns the 7 iso dates + from/to.
 */
/**
 * Which span the grid is showing.
 *
 * Both resolve to the same shape — a contiguous list of local iso dates — so everything downstream
 * (the fan-out, the per-day arrays, the totals) is indifferent to which one is selected. Only the
 * range's construction and its label differ.
 */
export type Period = "week" | "month";

/**
 * The calendar month `offset` months back, as the same `{from, to, dates}` a week produces.
 *
 * Built from `setMonth(month + offset, 1)` rather than by adding days, so it lands on real month
 * boundaries — 28, 29, 30 and 31-day months all come out right, and February in a leap year needs
 * no special case.
 *
 * The server caps a timesheet range at 92 days, so a single month is comfortably inside it.
 */
function monthOf(
  now: Date,
  offset = 0,
): {
  from: string;
  to: string;
  dates: string[];
} {
  const first = new Date(now);
  first.setDate(1); // before changing the month: the 31st would otherwise skid into the next one
  first.setMonth(first.getMonth() + offset);
  first.setHours(0, 0, 0, 0);
  // Day 0 of the following month is the last day of this one — the trick that avoids a length table.
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const dates = Array.from({ length: last.getDate() }, (_, i) => {
    const d = new Date(first);
    d.setDate(1 + i);
    return isoLocal(d);
  });
  return { from: dates[0], to: dates[dates.length - 1], dates };
}

function weekOf(
  now: Date,
  offset = 0,
): {
  from: string;
  to: string;
  dates: string[];
} {
  const dow = (now.getDay() + 6) % 7; // Mon = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoLocal(d);
  });
  return { from: dates[0], to: dates[6], dates };
}

/**
 * "Jun 23 – 29, 2026" from a range's first/last iso date (`YYYY-MM-DD`).
 *
 * Reads the **last element**, not `dates[6]`: a month is 28-31 dates, and indexing the seventh
 * would have labelled every month as its first week while the grid showed the whole thing.
 */
/** "12 – 18 Oct 2026" — the shared range notation (UX audit XC-06 / TIME-14), not a hand-built one. */
function weekLabelOf(dates: string[]): string {
  return formatDateRange(dates[0], dates[dates.length - 1]);
}

interface Fetched {
  emp: ApiEmployee;
  grid: ApiGridResponse;
  /** Avg activity 0–100, or null when the agent hasn't scored this week. */
  avgScore: number | null;
  daysScored: number;
}

export interface TeamTimesheet {
  teamRows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  /**
   * The iso dates the rows' `days` arrays are aligned to — those of the period the rows were **read
   * for**. While another period loads, the previous rows stay on screen against their own dates.
   */
  dates: string[];
  /** Human range for the **selected** week, e.g. "Jun 23 – 29, 2026". */
  weekLabel: string;
  /** Some period has been read — the grid can stay on screen (dimmed) while the next one loads. */
  loaded: boolean;
  loading: boolean;
  /** Set on a hard failure; a `403` on the team endpoint reads as an access problem. */
  error: string | null;
  /** True specifically when the caller lacks team-time access (403). */
  forbidden: boolean;
  /** Manual refetch of the current week's fan-out (for a Refresh button). Does not start a poll. */
  reload: () => void;
  /**
   * Names of the people whose period held more sessions than the server returns in one read — their
   * hours here are a floor, not the whole period (WP-434). Empty in any ordinary week.
   */
  truncated: string[];
}

/** A department label that is never a raw id — and "No department" for the directory's own bucket. */
function deptLabelOf(depts: Map<string, string>, id: string): string {
  if (!id) return "—";
  if (id === UNASSIGNED_DEPT) return "No department";
  return depts.get(id) ?? UNKNOWN_DEPARTMENT;
}

/**
 * @param enabled Only fetch when the caller is actually looking at the team view — a pure employee
 *   never triggers the fan-out, and nor does a manager looking at "My time".
 * @param weekOffset Which week to read: `0` = this week, `-1` = last week, and so on. Each change
 *   re-runs the whole fan-out for that week — the per-user endpoints take an arbitrary `from`/`to`,
 *   so no week is privileged, but a step back costs one round of (employees × 2) requests.
 * @param readActivity Whether per-person activity scores can be read at all (`monitoring.activity`
 *   in effect). Off, each person's activity read would only 403, so it is not made.
 */
export function useTeamTimesheet(
  enabled: boolean,
  offset = 0,
  period: Period = "week",
  readActivity = true,
): TeamTimesheet {
  const [data, setData] = useState<{
    fetched: Fetched[];
    depts: Map<string, string>;
    projects: Map<string, { name: string; key: string }>;
    /** The period these rows were read for — not necessarily the one selected now. */
    range: { from: string; to: string; dates: string[] };
  } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  // Manual refetch of the current week's fan-out (for a Refresh button). A bare counter, not a poll.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // "Today" is resolved once, client-side (avoids SSR drift + keeps the range stable). The visible
  // week is derived from that fixed anchor plus the caller's offset, so paging back never re-reads
  // the clock — a session open across midnight keeps a stable notion of which week is "this" one.
  const anchor = useRef(new Date());
  const week = useMemo(
    () =>
      period === "month"
        ? monthOf(anchor.current, offset)
        : weekOf(anchor.current, offset),
    [offset, period],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    setForbidden(false);

    const { from, to } = week;

    (async () => {
      // Directory + label maps + the project catalog — one call each, before the fan-out.
      const [employees, depts, projectList, contributors] = await Promise.all([
        listAllEmployees(),
        departmentMap().catch(() => new Map<string, string>()),
        listProjects().catch(() => []),
        // A failed roles read must not empty the grid — fall back to "everyone is a contributor",
        // which is the pre-filter behaviour (a stray dashes row beats a blank page).
        contributorRoleIds().catch(() => null),
      ]);
      const projects = new Map(
        projectList.map((p) => [p.id, { name: p.name, key: p.key ?? "" }]),
      );

      // Only people who can actually run a timer. Owner/Admin hold no `TimeTrackSelf`, so they have
      // no time by construction and rendered as a permanent row of dashes. See `contributorRoleIds`
      // for why this keys on the permission rather than on `is_owner`.
      const active = employees.filter(
        (e) =>
          e.status === "active" &&
          // Benched employees are excluded from Time-Tracking entirely.
          !e.benched &&
          (contributors === null || (e.role_id ? contributors.has(e.role_id) : true)),
      );

      // **Only the people the caller can reach.** The server lets `TimeReadOrg` (or an owner) read
      // anyone and `TimeReadTeam` only their own department. Asking for everyone meant a team lead's
      // first out-of-department read came back 403, and that one 403 blanked the whole page as
      // "no access" (QA audit 2026-10-08, WP-055). No `perm` claim (an old session) is no verdict:
      // ask for everyone and let the per-person 403s below sort it out.
      const me = useAuthStore.getState().user;
      const orgBit = hasPermissionBit(me?.perm, TIME_READ_ORG_BIT);
      const orgWide = Boolean(me?.isOwner) || orgBit !== false;
      const myDept = employees.find((e) => e.user_id === me?.id)?.department_id;
      const reachable = orgWide
        ? active
        : active.filter((e) => Boolean(myDept) && e.department_id === myDept);

      let forbiddenCount = 0;
      const results = await mapWithConcurrency(reachable, 4, (emp) =>
        (async (): Promise<Fetched | null> => {
          // A run the viewer has already stepped past stops asking — discarding its answer was not
          // enough to stop its whole fan-out from still going out.
          if (!live) return null;
          // The timesheet read gates the whole view — a 403 here is propagated below.
          const grid = await getUserTimesheet(emp.user_id, from, to);
          // Activity is secondary: if it errors (incl. a 403 on activity:read), it is "not scored".
          let avgScore: number | null = null;
          let daysScored = 0;
          if (readActivity) {
            try {
              const act = await getUserActivity(emp.user_id, from, to);
              avgScore = act.trend.avg_score;
              daysScored = act.trend.days_scored;
            } catch {
              /* no honest activity number → unscored */
            }
          }
          return { emp, grid, avgScore, daysScored };
        })().then(
          (r) => r,
          // A 403 is about that one person being out of reach, not about the whole team: skip the
          // row. Only when every read was refused is it the caller's access, below.
          (e) => {
            if (isForbidden(e)) forbiddenCount += 1;
            return null;
          },
        ),
      );

      if (!live) return;
      const fetched = results.filter((r): r is Fetched => r !== null);
      if (
        fetched.length === 0 &&
        reachable.length > 0 &&
        forbiddenCount === reachable.length
      ) {
        setForbidden(true);
        setError("You don't have access to team time.");
        return;
      }
      setData({ fetched, depts, projects, range: week });
    })()
      .catch((e) => {
        if (!live) return;
        if (isForbidden(e)) {
          setForbidden(true);
          setError("You don't have access to team time.");
        } else {
          setError("Couldn't load team timesheets. Retry.");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [enabled, week, nonce, readActivity]);

  const derived = useMemo(() => {
    if (!data) {
      return {
        teamRows: [] as TeamMemberTime[],
        projectRows: [] as ProjectTimesheet[],
      };
    }
    const { fetched, depts, projects } = data;
    // The period the rows were READ for. Mapping them onto the newly selected one while it loads put
    // last week's sessions in no column at all (QA audit 2026-10-08, WP-200).
    const { dates } = data.range;
    // Weekday index for an iso date; -1 for anything outside the current week.
    const dateIndex = new Map(dates.map((d, i) => [d, i] as const));
    const projectName = (pid: string | undefined) => {
      const id = pid?.trim();
      if (!id) return "No project";
      return projects.get(id)?.name ?? UNKNOWN_PROJECT;
    };

    // ── teamRows ──────────────────────────────────────────────────────────
    const teamRows: TeamMemberTime[] = fetched.map(
      ({ emp, grid, avgScore, daysScored }) => {
        const trackedHrs = exactHours(grid.total_secs / 3600);
        const billablePct =
          grid.total_secs > 0
            ? Math.round((grid.billable_secs / grid.total_secs) * 100)
            : 0;
        // No agent score this week → `null` (unscored), never a guess and never a 0.
        const activity =
          daysScored === 0 || avgScore === null ? null : Math.round(avgScore);
        // Only flag on a *real* low score for someone who tracked time. Missing agent data is not
        // evidence of a problem, so it must not fabricate a flag.
        const status: TimesheetStatus =
          activity !== null && trackedHrs > 0 && activity < 50 ? "flagged" : "on-track";

        // Real per-day hours + entries, aligned to `dates` — **7 for a week, 28–31 for a month**.
        // Sizing these to a hardcoded 7 crashed the whole page the moment Month was selected: a
        // month's `di` reaches 30, and `dayEntries[di].push(...)` on a 7-slot array is
        // `undefined.push` — thrown inside this memo, so the route error boundary caught it.
        const days = new Array(dates.length).fill(0) as number[];
        const dayEntries: TimesheetDayEntry[][] = Array.from(
          { length: dates.length },
          () => [] as TimesheetDayEntry[],
        );
        for (const day of grid.days) {
          const di = dateIndex.get(day.date);
          if (di === undefined) continue;
          days[di] = exactHours(day.total_secs / 3600);
          for (const entry of day.entries) {
            dayEntries[di].push({
              label: projectName(entry.project_id),
              hours: exactHours((entry.duration_secs ?? 0) / 3600),
              // Carry the session itself, not just its project and length: the drill-down shows an
              // admin what was worked on, which a per-project roll-up cannot answer.
              session: {
                id: entry.session_id,
                description: entry.description?.trim() ?? "",
                taskId: entry.task_id,
                taskTitle: [entry.task_title?.trim(), entry.subtask_title?.trim()]
                  .filter(Boolean)
                  .join(" · "),
                start: clockOf(entry.start),
                startMs: entry.start,
                end: entry.end === undefined ? null : clockOf(entry.end),
                billable: entry.billable,
                running: entry.end === undefined,
                stopReason: entry.stop_reason,
                taskInvalid: entry.task_invalid ?? false,
              },
            });
          }
        }

        return {
          id: emp.user_id,
          name: emp.name,
          department: deptLabelOf(depts, emp.department_id),
          trackedHrs,
          days,
          dayEntries,
          idleHrs: 0, // no honest source for idle time yet
          billableHrs: exactHours(grid.billable_secs / 3600),
          billablePct,
          activity,
          status,
        };
      },
    );

    // (There was a `teamWeekly` series here, summed over everyone fetched. The cards above the grid
    // totalled it while the grid totalled the rows in view plus their running sessions, so the two
    // read 00:00:00 and 20:00:00 one above the other. The cards now total the grid's own rows —
    // QA audit 2026-10-08, WP-196.)

    // ── projectRows (aggregate every entry by project) ────────────────────
    interface Agg {
      secs: number;
      users: Set<string>;
      deptCounts: Map<string, number>;
      /** Real hours per weekday, Mon→Sun. */
      days: number[];
      /** Real per-day entries (contributor name + hours), Mon→Sun. */
      dayEntries: TimesheetDayEntry[][];
    }
    const newAgg = (): Agg => ({
      secs: 0,
      users: new Set(),
      deptCounts: new Map(),
      // Sized to `dates` (7 or 28–31), not a hardcoded 7 — the project grouping hit the same
      // `dayEntries[di].push` crash on Month as the per-employee rows above.
      days: new Array(dates.length).fill(0) as number[],
      dayEntries: Array.from({ length: dates.length }, () => [] as TimesheetDayEntry[]),
    });
    const byProject = new Map<string, Agg>();
    for (const { emp, grid } of fetched) {
      const dept = deptLabelOf(depts, emp.department_id);
      for (const day of grid.days) {
        const di = dateIndex.get(day.date);
        for (const entry of day.entries) {
          const pid = entry.project_id?.trim();
          if (!pid) continue; // an entry with no project can't be grouped
          const agg = byProject.get(pid) ?? newAgg();
          const secs = entry.duration_secs ?? 0; // a running session has no duration yet → 0
          agg.secs += secs;
          agg.users.add(emp.user_id);
          agg.deptCounts.set(dept, (agg.deptCounts.get(dept) ?? 0) + 1);
          if (di !== undefined) {
            agg.days[di] = exactHours(agg.days[di] + secs / 3600);
            agg.dayEntries[di].push({
              label: emp.name,
              hours: exactHours(secs / 3600),
              // So the grid's live top-up ticks a project row too, as it does the person's row.
              ...(entry.end === undefined ? { runningSinceMs: entry.start } : {}),
            });
          }
          byProject.set(pid, agg);
        }
      }
    }
    const projectRows: ProjectTimesheet[] = [...byProject.entries()].map(([pid, agg]) => {
      const meta = projects.get(pid);
      // Projects carry no department in the API; the honest stand-in is the team doing the
      // most work on it (the modal contributor department), or "—" if unknown.
      let dept = "—";
      let best = 0;
      for (const [d, c] of agg.deptCounts) {
        if (c > best) {
          best = c;
          dept = d;
        }
      }
      const trackedHrs = exactHours(agg.secs / 3600);
      return {
        id: pid,
        name: meta?.name ?? UNKNOWN_PROJECT,
        key: meta?.key ?? "",
        department: dept,
        members: agg.users.size,
        trackedHrs,
        days: agg.days,
        dayEntries: agg.dayEntries,
        // Never flagged. A project has no activity score, and "no hours this period" is not a
        // problem — a red "Flagged" on a quiet project said there was one (UX audit 2026-10-16,
        // TIME-16). A project with no hours in the period doesn't get a row at all anyway.
        status: "on-track",
      };
    });

    return { teamRows, projectRows };
  }, [data]);

  // The stepper names the period being asked for; the columns are the period the rows were read for.
  const weekLabel = useMemo(() => weekLabelOf(week.dates), [week]);
  const dates = data?.range.dates ?? week.dates;

  const truncated = useMemo(
    () =>
      (data?.fetched ?? [])
        .filter(({ grid }) => grid.truncated === true)
        .map(({ emp }) => emp.name),
    [data],
  );

  return {
    ...derived,
    dates,
    weekLabel,
    loaded: data !== null,
    loading,
    error,
    forbidden,
    reload,
    truncated,
  };
}
