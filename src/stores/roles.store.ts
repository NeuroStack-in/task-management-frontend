import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/types/rbac";
import { SYSTEM_ROLES } from "@/constants/roles";
import { WILDCARD, ALL_PERMISSIONS } from "@/constants/permissions";

/** Permission ids that currently exist — used to scrub stale persisted roles. */
const VALID_PERMISSIONS = new Set<string>([
  WILDCARD,
  ...ALL_PERMISSIONS.map((p) => p.id),
]);

/**
 * Renamed permission ids, old → new. Applied before the scrub, because a rename
 * must PRESERVE the grant: scrubbing would silently revoke a capability the role
 * still legitimately holds.
 *
 * `time-tracking:edit` → `time-tracking:self` mirrors wp-contracts, where the bit
 * index (110) is deliberately unchanged — renaming is free, renumbering would
 * rewrite every issued and stored bitset. Same capability, better name: it means
 * "I personally run a timer", never "may edit time entries" (LLD §4 makes time
 * immutable, so no one may edit an entry and no such permission exists).
 */
const RENAMED_PERMISSIONS: Record<string, string> = {
  "time-tracking:edit": "time-tracking:self",
};

/**
 * Read-only. Roles are created and edited on the server, through `modules/roles` — the mutators that
 * lived here (`createRole`, `cloneRole`, `updateRole`, `deleteRole`, `getRole`) had no callers
 * (QA audit 2026-10-08, WP-512). Nothing writes `customRoles` now; it holds only what an older
 * session persisted, and `use-permissions` resolves custom roles from the token's `perm` bitset.
 */
interface RolesState {
  /** User-created roles only. System roles are merged in via getAllRoles(). */
  customRoles: Role[];
  getAllRoles: () => Role[];
}

export const useRolesStore = create<RolesState>()(
  persist(
    (_set, get) => ({
      customRoles: [],

      getAllRoles: () => [...SYSTEM_ROLES, ...get().customRoles],
    }),
    {
      name: "wp-roles",
      // v2 (2026-07-16): `time-tracking:edit` → `time-tracking:self`. Bump this whenever
      // a permission id is renamed or removed — `migrate` only runs when the version
      // changes, so leaving it pinned silently strands every already-persisted role.
      version: 2,
      // Map renames first, then drop ids that no longer exist, so a stale custom role
      // can't grant invalid access — and a renamed one doesn't lose a valid grant.
      migrate: (persisted) => {
        const state = persisted as { customRoles?: Role[] } | undefined;
        const customRoles = (state?.customRoles ?? []).map((r) => ({
          ...r,
          permissions: r.permissions
            .map((p) => RENAMED_PERMISSIONS[p] ?? p)
            .filter((p) => VALID_PERMISSIONS.has(p)),
        }));
        return { customRoles } as RolesState;
      },
    },
  ),
);
