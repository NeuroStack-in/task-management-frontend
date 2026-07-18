"use client";

/**
 * One employee's profile, from the live backend (`GET /v1/employees/{id}`), with department / team /
 * role ids resolved to names. Fields the server doesn't carry — a productivity score, per-employee
 * project list, date of birth, postal address — are simply **absent**: they need the desktop agent
 * (monitoring) or endpoints that don't exist, so the view omits them rather than inventing them.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listRoles } from "@/modules/roles/services/roles.service";
import {
  getEmployeeProfile,
  departmentMap,
  teamMap,
} from "./services/employees.service";

export interface EmployeeProfileVM {
  id: string;
  name: string;
  email: string;
  empId: string | null;
  title: string | null;
  department: string | null;
  team: string | null;
  roleName: string | null;
  location: string | null;
  phone: string | null;
  status: "active" | "inactive";
  hireDate: string | null;
}

export interface EmployeeProfileState {
  profile: EmployeeProfileVM | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  reload: () => void;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function useEmployeeProfile(id: string): EmployeeProfileState {
  const [profile, setProfile] = useState<EmployeeProfileVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const [p, depts, teams, roles] = await Promise.all([
          getEmployeeProfile(id),
          departmentMap().catch(() => new Map<string, string>()),
          teamMap().catch(() => new Map<string, string>()),
          listRoles().catch(() => []),
        ]);
        if (!live) return;
        const roleName = roles.find((r) => r.id === p.role_id)?.name ?? p.role_id ?? null;
        setProfile({
          id: p.user_id,
          name: p.name,
          email: p.email,
          empId: p.emp_id ?? null,
          title: p.title ?? null,
          department: p.department_id ? (depts.get(p.department_id) ?? p.department_id) : null,
          team: p.team_id ? (teams.get(p.team_id) ?? p.team_id) : null,
          roleName,
          location: p.location ?? null,
          phone: p.phone ?? null,
          status: p.status === "deactivated" ? "inactive" : "active",
          hireDate: p.joined_at ? fmtDate(p.joined_at) : null,
        });
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { profile, loading, error, notFound, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this profile.";
    return e.message;
  }
  return "Couldn't load this employee. Check your connection and retry.";
}
