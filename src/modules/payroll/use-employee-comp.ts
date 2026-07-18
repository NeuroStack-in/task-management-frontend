"use client";

/**
 * Employee compensation — the roster to pick from, plus the write.
 *
 * The roster comes from the `workforce` directory (`GET /v1/employees`), because `payroll-billing`
 * serves no employee list of its own. Only **active** employees are offered: comp is stamped on the
 * `USER#` record and only active users are picked up by a draft run.
 *
 * There is no comp **read** endpoint, so this hook exposes no current rate — `setComp` is a blind
 * write, and the view says so rather than rendering a rate the server never sent.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  listEmployees,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import {
  setEmployeeComp,
  type ApiEmployeeComp,
  type SetCompRequest,
} from "./services/payroll.service";

export interface EmployeeCompState {
  /** Active employees, name-sorted — the pick list for the comp editor. */
  employees: ApiEmployee[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  setComp: (userId: string, req: SetCompRequest) => Promise<ApiEmployeeComp>;
}

/**
 * @param enabled pass `false` for callers without `payroll:manage` — the roster is only ever needed
 *   to target a comp write, so a read-only viewer shouldn't pull the directory at all.
 */
export function useEmployeeComp(enabled = true): EmployeeCompState {
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    listEmployees()
      .then((rows) => {
        if (!live) return;
        setEmployees(
          rows
            .filter((e) => e.status === "active")
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce, enabled]);

  const setComp = useCallback(
    (userId: string, req: SetCompRequest) => setEmployeeComp(userId, req),
    [],
  );

  return { employees, loading, error, reload, setComp };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the employee directory.";
    return e.message;
  }
  return "Couldn't load employees. Check your connection and retry.";
}
