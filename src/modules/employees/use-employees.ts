"use client";

/**
 * The employee directory, from the real backend.
 *
 * Maps the lean directory rows into the view's `EmployeeRow`, filling in department **names** from
 * the departments endpoint. Fields the directory doesn't serve degrade honestly rather than being
 * invented: email/role/team are blank (they live on the full profile), and `productivityScore` is
 * `null` — "not available yet", because the score needs the desktop agent's activity data.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useRolesStore } from "@/stores/roles.store";
import {
  listEmployees,
  departmentMap,
  deactivateEmployee,
  reactivateEmployee,
} from "./services/employees.service";

/** The row shape the view renders. `productivityScore: null` = unavailable (agent-blocked). */
export interface EmployeeRow {
  id: string;
  /** Human-facing employee id (e.g. `EMP-0001`); `null` for legacy rows that predate ids. */
  empId: string | null;
  name: string;
  email: string;
  avatarUrl?: string;
  roleName: string;
  jobTitle: string;
  department: string;
  team: string;
  status: "active" | "inactive" | "invited" | "suspended";
  /**
   * This person has **no login** — a monitored employee (MANAGED-AGENT.md §6.4), recorded by a
   * managed agent rather than by signing in. Distinct from "invited, hasn't accepted yet", which
   * looks identical in the roster and means the opposite.
   */
  monitored: boolean;
  productivityScore: number | null;
}

export interface EmployeesData {
  employees: EmployeeRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  deactivate: (id: string) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
}

/** Backend status → the view's union. The directory only ever emits active/deactivated. */
function mapStatus(s: string): EmployeeRow["status"] {
  if (s === "active") return "active";
  if (s === "deactivated") return "inactive";
  return "active";
}

export function useEmployees(): EmployeesData {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const getAllRoles = useRolesStore((s) => s.getAllRoles); // stable ref: role_id → name lookup

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [roster, depts] = await Promise.all([
          listEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;
        // role_id → display name (system + custom roles); blank if the id is unknown.
        const roleNames = new Map(getAllRoles().map((r) => [r.id, r.name]));
        setEmployees(
          roster.map((e) => ({
            id: e.user_id,
            empId: e.emp_id ?? null,
            name: e.name,
            email: "", // not on the directory list — lives on the full profile
            roleName: e.role_id ? (roleNames.get(e.role_id) ?? "") : "",
            jobTitle: e.title ?? "",
            department: depts.get(e.department_id) ?? e.department_id,
            team: "",
            status: mapStatus(e.status),
            // Absent on every row that predates the field, so this reads false for existing orgs.
            monitored: e.login === "none",
            // Needs insights (activity monitoring), which needs the agent. Null, not a fake 0.
            productivityScore: null,
          })),
        );
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, getAllRoles]);

  const deactivate = useCallback(
    async (id: string) => {
      await deactivateEmployee(id);
      reload();
    },
    [reload],
  );

  const reactivate = useCallback(
    async (id: string) => {
      await reactivateEmployee(id);
      reload();
    },
    [reload],
  );

  return { employees, loading, error, reload, deactivate, reactivate };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the employee directory.";
    return e.message;
  }
  return "Couldn't load employees. Check your connection and retry.";
}
