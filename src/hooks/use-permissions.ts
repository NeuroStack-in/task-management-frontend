"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import { permissionsFromBitset } from "@/lib/permission-bits";
import { useIsFeatureOn } from "@/hooks/use-features";
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
  return useMemo(() => resolveRole(user, customRoles), [user, customRoles]);
}

/** The resolution above, as a plain function — see [`useCurrentRole`] for the rules. */
export function resolveRole(
  user: ReturnType<typeof useAuthStore.getState>["user"],
  customRoles: Role[],
): Role | null {
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
}

/**
 * The role for the store's state *right now*, bypassing React.
 *
 * Redirect handlers run in the same tick as the sign-in that populated the store, so a value read
 * from `useCurrentRole()` there is still the pre-login `null` — it only updates on the next render.
 * Post-login landing decisions must not be made against that stale role.
 */
export function currentRoleSnapshot(): Role | null {
  return resolveRole(
    useAuthStore.getState().user,
    useRolesStore.getState().customRoles,
  );
}

/** Permission helpers bound to the current role. */
export function usePermissions() {
  const role = useCurrentRole();
  // The sidebar is filtered by BOTH gates: what the role may access, and what the org still has
  // switched on. Without the second, disabling a feature left its nav entry and pages fully
  // usable for everyone — including the owner who had just turned it off.
  const isFeatureOn = useIsFeatureOn();
  return {
    role,
    can: (permission: PermissionId | null) => canAccess(role, permission),
    canAll: (permissions: PermissionId[]) => canAll(role, permissions),
    canAny: (permissions: PermissionId[]) => canAny(role, permissions),
    nav: getAccessibleNav(role, isFeatureOn),
  };
}
