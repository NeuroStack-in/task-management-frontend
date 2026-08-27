"use client";

/**
 * The org dashboard's data — assembled from the **live backend**, honestly.
 *
 * Three real sources feed this aggregate: the employee directory (`/v1/employees`), billing
 * (`/v1/billing`), and projects (`/v1/projects` + per-project KPI). Everything derivable from those
 * is real.
 *
 * Two more real signals now have endpoints and are rendered by **self-fetching** widgets that ignore
 * this summary: the AI daily briefing (`/v1/me/insights/summary`) and org attendance for a day
 * (`/v1/attendance/day`) — both derived from attendance + timesheet, so they work without the agent.
 * See `AttendanceTodayCard` in `real-widgets.tsx`; the self-scoped daily recap is
 * `DailySummaryCard` (insights), mounted on the personal dashboard.
 *
 * What still needs the **desktop agent's activity data** — org-wide productivity scores, tracked
 * hours, screenshots, heatmaps, per-team productivity — has no data feed yet and is shown as an
 * honest agent-pending placeholder rather than a seeded number, never faked.
 *
 * The per-project KPI fan-out is **bounded** (see {@link mapWithConcurrency}) — an unbounded burst
 * throttles the Lambda and 503s the page.
 */
import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { UNKNOWN_DEPARTMENT } from "@/lib/format";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  listEmployees,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import {
  listProjects,
  getProject,
} from "@/modules/projects/services/projects.service";
import { getBillingOverview } from "@/modules/billing/services/billing.service";

/** Bounded per-project KPI reads — small cap so a large org doesn't burst the Lambda. */
const PROJECT_FANOUT = 3;

export interface DepartmentHeadcount {
  name: string;
  count: number;
}

export interface ProjectRollup {
  total: number;
  active: number;
  onHold: number;
  completed: number;
  /** Open (not-done) tasks across all projects whose KPI has been computed. */
  openTasks: number;
  overdue: number;
  /** Average completion % across projects that have a KPI. `null` if none do yet. */
  avgCompletion: number | null;
  /** How many projects had a computed KPI (the aggregator may not have run for all). */
  kpiCoverage: number;
}

export interface DashboardSummary {
  employees: {
    total: number;
    active: number;
    inactive: number;
    departments: number;
    byDepartment: DepartmentHeadcount[];
  };
  billing: {
    plan: string;
    seatsUsed: number;
    seatCap: number;
    status: string;
  } | null;
  projects: ProjectRollup;
}

export interface DashboardSummaryState {
  summary: DashboardSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboardSummary(): DashboardSummaryState {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live: a quiet background re-fetch every 30 s, so time on screen keeps up with what the
  // agents have uploaded. `reload` stays the visible path; the poll uses `refresh`.
  const { nonce, reload, isBackground } = useLiveRefresh();
  useEffect(() => {
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);

    (async () => {
      try {
        // Billing is best-effort: a missing/forbidden subscription must not blank the whole board.
        const [roster, depts, projectList, billing] = await Promise.all([
          listEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
          listProjects(),
          getBillingOverview().catch(() => null),
        ]);

        // Per-project KPI, bounded + skip-on-fail (a project whose detail 503s just contributes no KPI).
        const details = await mapWithConcurrency(projectList, PROJECT_FANOUT, (p) =>
          getProject(p.id).catch(() => null),
        );

        if (!live) return;

        // Employees.
        const active = roster.filter((e) => e.status === "active").length;
        const byDeptMap = new Map<string, number>();
        for (const e of roster) {
          const label =
            depts.get(e.department_id) ??
            (e.department_id ? UNKNOWN_DEPARTMENT : "Unassigned");
          byDeptMap.set(label, (byDeptMap.get(label) ?? 0) + 1);
        }
        const byDepartment = [...byDeptMap.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Projects.
        let openTasks = 0;
        let overdue = 0;
        let completionSum = 0;
        let kpiCoverage = 0;
        for (const d of details) {
          if (!d?.kpi) continue;
          kpiCoverage += 1;
          completionSum += d.kpi.completion_pct;
          overdue += d.kpi.overdue_count;
          openTasks += d.kpi.total_tasks - d.kpi.tasks_by_status.done;
        }
        const byStatus = { active: 0, onHold: 0, completed: 0 };
        for (const p of projectList) {
          if (p.status === "completed" || p.status === "archived") byStatus.completed += 1;
          else if (p.status === "on_hold") byStatus.onHold += 1;
          else byStatus.active += 1;
        }

        setSummary({
          employees: {
            total: roster.length,
            active,
            inactive: roster.length - active,
            departments: byDeptMap.size,
            byDepartment,
          },
          billing: billing
            ? {
                plan: billing.plan,
                seatsUsed: billing.seats_used,
                seatCap: billing.seat_cap,
                status: billing.status,
              }
            : null,
          projects: {
            total: projectList.length,
            active: byStatus.active,
            onHold: byStatus.onHold,
            completed: byStatus.completed,
            openTasks,
            overdue,
            avgCompletion: kpiCoverage ? Math.round(completionSum / kpiCoverage) : null,
            kpiCoverage,
          },
        });
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, isBackground]);

  return { summary, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the dashboard.";
    return e.message;
  }
  return "Couldn't load the dashboard. Check your connection and retry.";
}
