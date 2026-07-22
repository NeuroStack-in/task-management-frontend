"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import { permissionsFromBitset } from "@/lib/permission-bits";
import type { PermissionId, Role } from "@/types/rbac";

/**
 * Resolves the current user's Role object. System roles come from the hardcoded catalog; anything
 * else — a **server-created custom role**, which the local store has never heard of — is derived
 * from the JWT's `perm` bitset (the server's own truth, decoded via `lib/permission-bits`). Without
 * that fallback a custom-role member gets `can() === false` for everything and an empty sidebar
 * even though the server grants them real access.
 */
export function useCurrentRole(): Role | null {
  const user = useAuthStore((s) => s.user);
  const customRoles = useRolesStore((s) => s.customRoles);
  return useMemo(() => {
    if (!user) return null;
    const all = [...SYSTEM_ROLES, ...customRoles];
    const found = all.find((r) => r.id === user.roleId);
    if (found) return found;
    const derived = permissionsFromBitset(user.perm);
    if (!derived) return null; // pre-bitset session and unknown role — old behavior
    return {
      id: user.roleId,
      name: "Custom role",
      description: "Permissions resolved from the server's token bitset.",
      system: false,
      scope: "org",
      permissions: derived,
    };
  }, [user, customRoles]);
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
