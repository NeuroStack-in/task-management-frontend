/**
 * Single source of truth for an employee's weekly time metrics (SPEC.md §5).
 *
 * Deterministic from the user id (no randomness / no dates), so EVERY page that
 * shows a person's hours — Time Tracking (team view), Insights → Reports, the
 * Utilization report, etc. — derives the SAME numbers. Do not re-derive these
 * formulas anywhere else; import `employeeWeek` instead.
 */

const hash = (id: string) => [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);

export interface EmployeeWeek {
  /** Contracted hours per week. */
  capacity: number;
  /** Hours tracked this week. */
  tracked: number;
  /** Idle hours this week. */
  idle: number;
  /** Billable hours this week. */
  billableHrs: number;
  /** Billable as a % of tracked time. */
  billablePct: number;
  /** Utilization: billable as a % of capacity. */
  utilization: number;
}

export function employeeWeek(id: string): EmployeeWeek {
  const seed = hash(id);
  const capacity = 40;
  const tracked = 30 + (seed % 14); // 30–43h
  const idle = 1 + (seed % 5); // 1–5h
  const billableHrs = 14 + (seed % 28); // 14–41h
  const billablePct = Math.min(100, Math.round((billableHrs / tracked) * 100));
  const utilization = Math.min(100, Math.round((billableHrs / capacity) * 100));
  return { capacity, tracked, idle, billableHrs, billablePct, utilization };
}
