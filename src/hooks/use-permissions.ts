"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import {
  WILDCARD,
  CONTRIBUTOR_ONLY_PERMISSIONS,
} from "@/constants/permissions";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import { permissionsFromBitset } from "@/lib/permission-bits";
import { useIsFeatureOn, useTrackingMode } from "@/hooks/use-features";
import { isPathModeHidden } from "@/constants/features";
import type { PermissionId, Role } from "@/types/rbac";

/**
 * Resolves the current user's Role object.
 *
 * **Permissions come from the JWT's `perm` bitset — the server's own truth — for every role.** The
 * local catalog (`constants/roles.ts`) contributes the display name only, and its permission lists
 * are a fallback for sessions minted before the bitset was stamped. Owner is the one exception:
 * `is_owner` lives outside the bitset, so it maps to the wildcard plus whatever contributor-only
 * ids the claim carries.
 *
 * This ordering is load-bearing. Admin and Employee are per-org editable on the server, and the
 * hardcoded lists had drifted from `wp-contracts::roles` besides — reading the catalog first meant
 * showing menus the server refuses and hiding pages it allows.
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
  // The local catalog supplies **identity** (name, description, scope) for a role the UI knows
  // about. It no longer supplies permissions unless nothing better exists — see below.
  const known =
    [...SYSTEM_ROLES, ...customRoles].find((r) => r.id === user.roleId) ?? null;

  // `is_owner` is a flag *outside* the bitset (wp-contracts::roles) — an Owner's `perm` claim is
  // nearly empty, so deriving their UI from it would strip the whole console. The wildcard is the
  // frontend's equivalent, and `canAccess` already refuses to let it grant contributor-only ids.
  // Those still come off the bitset, mirroring the server's one carve-out: an Owner who also
  // contributes holds `TimeTrackSelf` explicitly and should see their own timer.
  if (user.isOwner) {
    const derived = permissionsFromBitset(user.perm) ?? [];
    const contributor = derived.filter((id) =>
      CONTRIBUTOR_ONLY_PERMISSIONS.includes(id),
    );
    return {
      ...(known ?? OWNER_SHAPE),
      permissions: [WILDCARD, ...contributor],
    };
  }

  // **The server's bitset wins for every other role, system ones included.**
  //
  // This used to short-circuit on the local catalog, which was wrong in two compounding ways.
  // Admin and Employee are *per-org editable* (`identity::update_role` writes the customised set
  // onto the `ROLE#` item the pre-token trigger reads), so an org that had trimmed or extended its
  // Admin role still got the hardcoded default rendered. And the hardcoded defaults had themselves
  // drifted from `wp-contracts::roles` — Admin listed `payroll:*` the server never grants (a menu
  // that 403s), Employee listed `tasks:create`/`tasks:edit` it never grants, and Employee omitted
  // `reports:view` the server *does* grant (a page hidden from someone entitled to it).
  //
  // Taking permissions from the claim removes both failure modes at once: there is exactly one
  // source of truth, and it is the same one the server gates on. The catalog entry is still used
  // for the display name, so an Admin does not suddenly render as "Custom role".
  const derived = permissionsFromBitset(user.perm);
  if (derived) {
    return known
      ? { ...known, permissions: derived }
      : {
          id: user.roleId,
          name: "Custom role",
          description: "Permissions resolved from the server's token bitset.",
          system: false,
          scope: "org",
          permissions: derived,
        };
  }

  // No usable `perm` claim — a session persisted before the bitset was stamped. Fall back to the
  // catalog so an old tab keeps working; it refreshes to the real thing on the next token.
  return known;
}

/** Identity for an Owner whose `roleId` is not in the local catalog (e.g. a custom role + owner). */
const OWNER_SHAPE = {
  id: "role-owner",
  name: "Organization Owner",
  description: "Full, unrestricted access to the entire platform.",
  system: true,
  scope: "org",
} as const;

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
  // …and by the org's tracking mode, which hides whole route families (Projects/Leave/Payroll in
  // `machine` mode) including key-less ones (MANAGED-AGENT.md §4/§8).
  const mode = useTrackingMode();
  return {
    role,
    can: (permission: PermissionId | null) => canAccess(role, permission),
    canAll: (permissions: PermissionId[]) => canAll(role, permissions),
    canAny: (permissions: PermissionId[]) => canAny(role, permissions),
    nav: getAccessibleNav(role, isFeatureOn, (href) =>
      isPathModeHidden(href, mode),
    ),
  };
}
