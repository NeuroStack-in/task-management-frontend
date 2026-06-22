"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import type { PermissionId, Role } from "@/types/rbac";

/** Resolves the current user's Role object (system or custom). */
export function useCurrentRole(): Role | null {
  const user = useAuthStore((s) => s.user);
  const customRoles = useRolesStore((s) => s.customRoles);
  if (!user) return null;
  const all = [...SYSTEM_ROLES, ...customRoles];
  return all.find((r) => r.id === user.roleId) ?? null;
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
