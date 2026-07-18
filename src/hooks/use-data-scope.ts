"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { useDirectory } from "@/hooks/use-directory";
import type { RoleScope } from "@/types/rbac";

export interface DataScope {
  scope: RoleScope;
  /** Ids in scope, or null for org-wide (everyone). */
  ids: Set<string> | null;
  /** True if the given user id is visible to the current user. */
  inScope: (id: string) => boolean;
  /** True when the current role is limited to its own team (e.g. a Team Lead). */
  isTeamScoped: boolean;
  /** True while the roster needed to resolve a team scope is still loading. */
  loading: boolean;
}

/**
 * Resolves the current user's data-visibility scope from their role, against the **real** employee
 * directory (`GET /v1/employees`).
 *
 * - `org`  → everyone (`null`), resolved instantly — no roster fetch needed.
 * - `self` → only the user themselves — no roster fetch needed.
 * - `team` → the caller's department. The lean directory carries `department_id` for every employee
 *   (including the caller), but **not** `team_id` (that lives only on the full profile), so the
 *   tightest boundary the live roster supports today is the department. When it can't find the
 *   caller in the roster it degrades to self-only rather than over-sharing.
 *
 * Note the server's field-mask is the real boundary regardless (CLAUDE.md pattern 4); this scope is
 * UX convenience — it decides what a team-scoped user is *shown*, not what they're *allowed*.
 */
export function useDataScope(): DataScope {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();
  const scope: RoleScope = role?.scope ?? "org";

  // Only team scope needs the roster; skip the fetch (and its 403 for non-viewers) otherwise.
  const needsRoster = scope === "team";
  const { employees, loading } = useDirectory(needsRoster);

  const ids = useMemo(() => {
    if (!user) return new Set<string>();
    if (scope === "org") return null;
    if (scope === "self") return new Set([user.id]);
    const myDept = employees.find((e) => e.user_id === user.id)?.department_id;
    if (!myDept) return new Set([user.id]);
    return new Set(
      employees.filter((e) => e.department_id === myDept).map((e) => e.user_id),
    );
  }, [user, scope, employees]);

  return {
    scope,
    ids,
    inScope: (id: string) => ids === null || ids.has(id),
    isTeamScoped: scope === "team",
    loading: needsRoster && loading,
  };
}
