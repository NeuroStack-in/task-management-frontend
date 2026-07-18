"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { useServerRolesStore } from "@/stores/server-roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import type { PermissionId, Role } from "@/types/rbac";

/**
 * Resolves the current user's Role object.
 *
 * Resolution order, most authoritative first:
 *  1. **Server roles** (`GET /v1/roles`, projected through `lib/permission-map.ts`) — populated by
 *     `useServerRolesSync` in `DashboardShell`. This is what the server will actually enforce.
 *  2. **Built-in system roles** — the three seeded roles, and the fallback when the fetch failed or
 *     the member lacks `roles:view`.
 *  3. **Locally-created roles** (`wp-roles`, localStorage) — last, and only as a bridge for roles
 *     created in the UI before the server list refreshes.
 *
 * Order matters. Server-first is the fix for the drift where a role edited or created on the server
 * never reached the UI gate: previously a server-only custom role resolved to `null`, and
 * `canAccess(null, …)` denies everything, so the member saw an empty sidebar on every route the
 * server would have allowed.
 */
export function useCurrentRole(): Role | null {
  const user = useAuthStore((s) => s.user);
  const serverRoles = useServerRolesStore((s) => s.roles);
  const customRoles = useRolesStore((s) => s.customRoles);
  if (!user) return null;

  const byId = (r: Role) => r.id === user.roleId;
  return (
    serverRoles.find(byId) ??
    SYSTEM_ROLES.find(byId) ??
    customRoles.find(byId) ??
    null
  );
}

/** Permission helpers bound to the current role. */
export function usePermissions() {
  const role = useCurrentRole();
  return {
    role,
    can: (permission: PermissionId | null) => canAccess(role, permission),
    canAll: (permissions: PermissionId[]) => canAll(role, permissions),
    canAny: (permissions: PermissionId[]) => canAny(role, permissions),
    nav: getAccessibleNav(role),
  };
}
