"use client";

import { useEffect, useState } from "react";
import {
  listAllEmployees,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";

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

/** Bumped by `invalidateDirectory`, so a read that started before it cannot repopulate the cache. */
let generation = 0;

function load(): Promise<ApiEmployee[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    const gen = generation;
    // **Every** department partition. This was the bare `listEmployees()` — the call its own JSDoc
    // forbids — which returns the first 50 people and no cursor, so ten screens built rosters missing
    // everyone past the 50th: no enrolment code for "Zoe", devices "outside your directory", short
    // role counts (QA audit 2026-10-08, WP-020).
    inflight = listAllEmployees()
      .then((rows) => {
        if (gen === generation) cache = rows;
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
 * @param version bump to force a re-read after invalidating the cache (see `invalidateDirectory`).
 * @param enabled pass `false` to skip the fetch for callers that don't need the roster (e.g. a
 * self-scoped user resolving their own scope) — avoids a guaranteed 403 for anyone without
 * `employees:view`. Defaults to `true`.
 */
/**
 * Drop the cached roster so the next `useDirectory()` mount refetches.
 *
 * The cache is module-level and lives for the tab's lifetime, which is right for a list that rarely
 * changes — but a role assignment changes it. Callers that write to the directory (assigning a role,
 * benching someone) invalidate here so the next reader does not serve a roster contradicting the
 * change the user just made.
 */
export function invalidateDirectory(): void {
  cache = null;
  // Drop the settled (or in-flight) read too. Clearing only `cache` left `inflight` holding the old
  // resolved promise, so every later `load()` handed back the same stale rows for the life of the
  // tab — a role change never showed (WP-021).
  inflight = null;
  generation += 1;
}

export function useDirectory(enabled = true, version = 0): DirectoryData {
  const [employees, setEmployees] = useState<ApiEmployee[]>(cache ?? []);
  const [loading, setLoading] = useState(enabled && cache === null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (cache) {
      setEmployees(cache);
      setLoading(false);
      setError(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(false);
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
    // `version` is in the deps so a caller that invalidated the cache can force this to re-run.
    // Without it, `invalidateDirectory()` only takes effect on the next mount — a role change would
    // leave the list on screen contradicting the change the user just made.
  }, [enabled, version]);

  return { employees, loading, error };
}
