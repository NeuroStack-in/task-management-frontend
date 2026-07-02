"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { users } from "@/lib/data";
import { scopedUserIds } from "@/lib/scope";
import type { RoleScope } from "@/types/rbac";

export interface DataScope {
  scope: RoleScope;
  /** Ids in scope, or null for org-wide (everyone). */
  ids: Set<string> | null;
  /** True if the given user id is visible to the current user. */
  inScope: (id: string) => boolean;
  /** True when the current role is limited to its own team (e.g. a Team Lead). */
  isTeamScoped: boolean;
}

/**
 * Resolves the current user's data-visibility scope from their role. Team-scoped
 * roles (Manager / Team Lead) only see their own department+team; self-scoped
 * roles (Employee) see only themselves; everyone else sees the whole org.
 */
export function useDataScope(): DataScope {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();
  const scope: RoleScope = role?.scope ?? "org";
  const ids = useMemo(() => scopedUserIds(user, scope, users), [user, scope]);

  return {
    scope,
    ids,
    inScope: (id: string) => ids === null || ids.has(id),
    isTeamScoped: scope === "team",
  };
}
