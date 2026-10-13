"use client";

import { useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { SYSTEM_ROLES } from "@/constants/roles";
import {
  WILDCARD,
  CONTRIBUTOR_ONLY_PERMISSIONS,
} from "@/constants/permissions";
import { canAccess, canAll, canAny, getAccessibleNav } from "@/lib/rbac";
import { permissionsFromBitset, SERVER_ID_BITS } from "@/lib/permission-bits";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  useIsFeatureAllowed,
  useIsFeatureOn,
  useIsPageOn,
  useTrackingMode,
} from "@/hooks/use-features";
import { isPathModeHidden } from "@/constants/features";
import type { PermissionId, Role, RoleScope } from "@/types/rbac";

/**
 * A server-created custom role, in the local `Role` shape: its real name, description and scope from
 * `GET /v1/roles` (any member may read it), its permissions decoded the same way a token's are.
 */
function toLocalRole(r: ApiRole): Role {
  const claim = r.permissions
    .map((id) => SERVER_ID_BITS[id])
    .filter((bit): bit is number => bit !== undefined)
    .reduce((acc, bit) => acc | (BigInt(1) << BigInt(bit)), BigInt(0));
  const scope: RoleScope =
    r.scope === "self" || r.scope === "team" || r.scope === "org" ? r.scope : "org";
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    system: false,
    scope,
    permissions: permissionsFromBitset(claim.toString()) ?? [],
  };
}

/** Role ids already asked for on this page load — one `GET /v1/roles` per custom role, not per mount. */
const requestedRoleIds = new Set<string>();

/**
 * Learn a custom role's identity from the server and keep it in the (persisted) roles store, so the
 * next load has it before any request returns. Best-effort: on failure the placeholder stands.
 */
function loadServerRole(roleId: string): void {
  if (requestedRoleIds.has(roleId)) return;
  requestedRoleIds.add(roleId);
  listRoles()
    .then((roles) => {
      const found = roles.find((r) => r.id === roleId && !r.system);
      if (!found) return;
      useRolesStore.setState((s) => ({
        customRoles: [...s.customRoles.filter((c) => c.id !== roleId), toLocalRole(found)],
      }));
    })
    .catch(() => {
      /* keep the placeholder; the next page load asks again */
    });
}

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
  // A custom role's name and scope live only on the server's role record — the token carries the
  // bits, not the identity. Without this every custom role rendered as "Custom role" with scope
  // `org`, and the dashboard, profile and data-scope branches all took the org path for a `self` or
  // `team` role (QA audit 2026-10-08, WP-318). Owners resolve to the wildcard and need no lookup.
  const customRoleId =
    user && !user.isOwner && !SYSTEM_ROLES.some((r) => r.id === user.roleId) ? user.roleId : null;
  useEffect(() => {
    if (customRoleId) loadServerRole(customRoleId);
  }, [customRoleId]);
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
  // source of truth, and it is the same one the server gates on. The catalog entry — or, for a
  // custom role, the server's role record `useCurrentRole` fetched — supplies the name and scope.
  // Until that record arrives the placeholder below stands in, with its scope assumed `org`.
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
  // …and by the org's page-visibility toggles (layer 3). Owners are exempt inside the hook.
  const isPageOn = useIsPageOn();
  // Plan ceiling — passed so a feature the PLAN doesn't include stays in the sidebar (it opens an
  // Upgrade wall) instead of vanishing, while a feature the org toggled off is still hidden.
  const isFeatureAllowed = useIsFeatureAllowed();
  return {
    role,
    can: (permission: PermissionId | null) => canAccess(role, permission),
    canAll: (permissions: PermissionId[]) => canAll(role, permissions),
    canAny: (permissions: PermissionId[]) => canAny(role, permissions),
    nav: getAccessibleNav(
      role,
      isFeatureOn,
      (href) => isPathModeHidden(href, mode),
      isPageOn,
      isFeatureAllowed,
    ),
  };
}
