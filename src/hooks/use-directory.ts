"use client";

import { useEffect, useState } from "react";
import { listEmployees, type ApiEmployee } from "@/modules/employees/services/employees.service";

/**
 * Shared, cached access to the real employee directory (`GET /v1/employees`, the `workforce`
 * context). Several surfaces need the same roster — data-scope resolution, the locations board —
 * and the roster changes rarely within a session, so we fetch it **once** at module scope and hand
 * every caller the same array. This mirrors the old mock `users` import, but from the live backend.
 *
 * The list is deliberately lean (`{ user_id, name, title?, role_id?, status, department_id }`) — no
 * team_id, email, or productivity score (those live on the full profile / need the agent). Callers
 * must not assume fields beyond that.
 */
let cache: ApiEmployee[] | null = null;
let inflight: Promise<ApiEmployee[]> | null = null;

function load(): Promise<ApiEmployee[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = listEmployees()
      .then((rows) => {
        cache = rows;
        return rows;
      })
      .catch((e) => {
        // Let the next caller retry rather than caching a failure forever.
        inflight = null;
        throw e;
      });
  }
  return inflight;
}

export interface DirectoryData {
  employees: ApiEmployee[];
  loading: boolean;
  /** True when the directory couldn't be loaded (e.g. the caller lacks `employees:view`). */
  error: boolean;
}

/**
 * @param enabled pass `false` to skip the fetch for callers that don't need the roster (e.g. a
 * self-scoped user resolving their own scope) — avoids a guaranteed 403 for anyone without
 * `employees:view`. Defaults to `true`.
 */
export function useDirectory(enabled = true): DirectoryData {
  const [employees, setEmployees] = useState<ApiEmployee[]>(cache ?? []);
  const [loading, setLoading] = useState(enabled && cache === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (cache) {
      setEmployees(cache);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    load()
      .then((rows) => {
        if (!live) return;
        setEmployees(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [enabled]);

  return { employees, loading, error };
}
