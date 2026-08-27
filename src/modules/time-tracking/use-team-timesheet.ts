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
 *  - **403 is the whole view's** — if the timesheet endpoint forbids the caller (`TimeReadTeam`
 *    missing), that is surfaced as an access error, not a silently empty grid.
 *
 * Everything is honest-or-absent: no fabricated hours. Activity is `0` when the agent hasn't scored
 * (`days_scored === 0`), tracked hours are exactly what the grid returns, idle has no real source
 * (0), and a row is only `flagged` when we have **real** activity below 50 on someone who tracked
 * time — never as a side effect of missing agent data.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  listEmployees,
  departmentMap,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import { UNKNOWN_DEPARTMENT, UNKNOWN_PROJECT } from "@/lib/format";
import { listProjects } from "@/modules/projects/services/projects.service";
import { getUserActivity } from "@/modules/insights/services/insights.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import {
  clockOf,
  getUserTimesheet,
  type ApiGridResponse,
} from "./services/timesheet.service";
import type {
  DailyHours,
  ProjectTimesheet,
  TeamMemberTime,
  TimesheetDayEntry,
  TimesheetStatus,
} from "./types";

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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const pad2 = (n: number) => String(n).padStart(2, "0");
/** Local `YYYY-MM-DD` (not `toISOString()`, which shifts to UTC and can hand back yesterday). */
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Mon–Sun of the week `offset` weeks from the one containing `now` (local).
 * `0` = this week, `-1` = last week. Returns the 7 iso dates + from/to.
 */
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

/** "Jun 23 – 29, 2026" from the week's first/last iso date (`YYYY-MM-DD`). */
function weekLabelOf(dates: string[]): string {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return { y, m: m - 1, d };
  };
  const a = parse(dates[0]);
  const b = parse(dates[6]);
  const m0 = MONTHS[a.m];
  const m1 = MONTHS[b.m];
  return a.m === b.m
    ? `${m0} ${a.d} – ${b.d}, ${b.y}`
    : `${m0} ${a.d} – ${m1} ${b.d}, ${b.y}`;
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
  teamWeekly: DailyHours[];
  /** The 7 iso dates (Mon→Sun) the rows' `days` arrays are aligned to. */
  dates: string[];
  /** Human range for the **selected** week, e.g. "Jun 23 – 29, 2026". */
  weekLabel: string;
  loading: boolean;
  /** Set on a hard failure; a `403` on the team endpoint reads as an access problem. */
  error: string | null;
  /** True specifically when the caller lacks team-time access (403). */
  forbidden: boolean;
}

const EMPTY_WEEK: DailyHours[] = DAY_LABELS.map((day) => ({
  day,
  hours: 0,
  billable: 0,
}));

/**
 * @param enabled Only fetch when the caller can actually see the team view — a pure employee never
 *   triggers the fan-out.
 * @param weekOffset Which week to read: `0` = this week, `-1` = last week, and so on. Each change
 *   re-runs the whole fan-out for that week — the per-user endpoints take an arbitrary `from`/`to`,
 *   so no week is privileged, but a step back costs one round of (employees × 2) requests.
 */
export function useTeamTimesheet(enabled: boolean, weekOffset = 0): TeamTimesheet {
  const [data, setData] = useState<{
    fetched: Fetched[];
    depts: Map<string, string>;
    projects: Map<string, { name: string; key: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  // "Today" is resolved once, client-side (avoids SSR drift + keeps the range stable). The visible
  // week is derived from that fixed anchor plus the caller's offset, so paging back never re-reads
  // the clock — a session open across midnight keeps a stable notion of which week is "this" one.
  const anchor = useRef(new Date());
  const week = useMemo(() => weekOf(anchor.current, weekOffset), [weekOffset]);

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
        listEmployees(),
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

      const results = await mapWithConcurrency(active, 4, (emp) =>
        (async (): Promise<Fetched | null> => {
          // The timesheet read gates the whole view — a 403 here is propagated below.
          const grid = await getUserTimesheet(emp.user_id, from, to);
          // Activity is secondary: if it errors (incl. a 403 on activity:read), degrade to 0.
          let avgScore: number | null = null;
          let daysScored = 0;
          try {
            const act = await getUserActivity(emp.user_id, from, to);
            avgScore = act.trend.avg_score;
            daysScored = act.trend.days_scored;
          } catch {
            /* no honest activity number → 0 */
          }
          return { emp, grid, avgScore, daysScored };
        })().then(
          (r) => r,
          // A 403 on the timesheet endpoint is the caller's access problem for the whole team —
          // re-throw so it becomes the forbidden state. Any other per-employee error is skipped.
          (e) => {
            if (isForbidden(e)) throw e;
            return null;
          },
        ),
      );

      if (!live) return;
      const fetched = results.filter((r): r is Fetched => r !== null);
      setData({ fetched, depts, projects });
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
  }, [enabled, week]);

  const derived = useMemo(() => {
    if (!data) {
      return {
        teamRows: [] as TeamMemberTime[],
        projectRows: [] as ProjectTimesheet[],
        teamWeekly: EMPTY_WEEK,
      };
    }
    const { fetched, depts, projects } = data;
    const { dates } = week;
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
        const trackedHrs = round1(grid.total_secs / 3600);
        const billablePct =
          grid.total_secs > 0
            ? Math.round((grid.billable_secs / grid.total_secs) * 100)
            : 0;
        // No agent score this week → 0, never a guess.
        const activity = daysScored === 0 ? 0 : Math.round(avgScore ?? 0);
        // Only flag on a *real* low score for someone who tracked time. Missing agent data
        // (activity 0) is not evidence of a problem, so it must not fabricate a flag.
        const status: TimesheetStatus =
          daysScored > 0 && trackedHrs > 0 && activity < 50 ? "flagged" : "on-track";

        // Real per-day hours + entries, aligned Mon→Sun to `dates`.
        const days = new Array(7).fill(0) as number[];
        const dayEntries: TimesheetDayEntry[][] = Array.from(
          { length: 7 },
          () => [] as TimesheetDayEntry[],
        );
        for (const day of grid.days) {
          const di = dateIndex.get(day.date);
          if (di === undefined) continue;
          days[di] = round1(day.total_secs / 3600);
          for (const entry of day.entries) {
            dayEntries[di].push({
              label: projectName(entry.project_id),
              hours: round1((entry.duration_secs ?? 0) / 3600),
              // Carry the session itself, not just its project and length: the drill-down shows an
              // admin what was worked on, which a per-project roll-up cannot answer.
              session: {
                id: entry.session_id,
                description: entry.description?.trim() ?? "",
                taskId: entry.task_id,
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
          department: depts.get(emp.department_id) ?? (emp.department_id ? UNKNOWN_DEPARTMENT : "—"),
          trackedHrs,
          days,
          dayEntries,
          idleHrs: 0, // no honest source for idle time yet
          billablePct,
          activity,
          status,
        };
      },
    );

    // ── teamWeekly (Mon–Sun, summed across everyone) ──────────────────────
    const byDate = new Map<string, { hours: number; billable: number }>();
    for (const { grid } of fetched) {
      for (const day of grid.days) {
        const slot = byDate.get(day.date) ?? { hours: 0, billable: 0 };
        slot.hours += day.total_secs / 3600;
        slot.billable += day.billable_secs / 3600;
        byDate.set(day.date, slot);
      }
    }
    const teamWeekly: DailyHours[] = dates.map((date, i) => {
      const slot = byDate.get(date) ?? { hours: 0, billable: 0 };
      return {
        day: DAY_LABELS[i],
        hours: round1(slot.hours),
        billable: round1(slot.billable),
      };
    });

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
      days: new Array(7).fill(0) as number[],
      dayEntries: Array.from({ length: 7 }, () => [] as TimesheetDayEntry[]),
    });
    const byProject = new Map<string, Agg>();
    for (const { emp, grid } of fetched) {
      const dept = depts.get(emp.department_id) ?? (emp.department_id ? UNKNOWN_DEPARTMENT : "—");
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
            agg.days[di] = round1(agg.days[di] + secs / 3600);
            agg.dayEntries[di].push({
              label: emp.name,
              hours: round1(secs / 3600),
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
      const trackedHrs = round1(agg.secs / 3600);
      return {
        id: pid,
        name: meta?.name ?? UNKNOWN_PROJECT,
        key: meta?.key ?? "",
        department: dept,
        members: agg.users.size,
        trackedHrs,
        days: agg.days,
        dayEntries: agg.dayEntries,
        status: trackedHrs > 0 ? "on-track" : "flagged",
      };
    });

    return { teamRows, projectRows, teamWeekly };
    // `week` is a real input: the rows are mapped onto its 7 dates, so a week change must re-derive
    // them. (It was a ref before the week became selectable, which is why it wasn't listed.)
  }, [data, week]);

  const { dates, weekLabel } = useMemo(() => {
    const d = week.dates;
    return { dates: d, weekLabel: weekLabelOf(d) };
  }, [week]);

  return { ...derived, dates, weekLabel, loading, error, forbidden };
}
