import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, PermissionId } from "@/types/rbac";
import { SYSTEM_ROLES } from "@/constants/roles";
import { WILDCARD, ALL_PERMISSIONS } from "@/constants/permissions";

/** Permission ids that currently exist — used to scrub stale persisted roles. */
const VALID_PERMISSIONS = new Set<string>([
  WILDCARD,
  ...ALL_PERMISSIONS.map((p) => p.id),
]);

interface RolesState {
  /** User-created roles only. System roles are merged in via getAllRoles(). */
  customRoles: Role[];
  getAllRoles: () => Role[];
  getRole: (id: string) => Role | undefined;
  createRole: (input: { name: string; description: string; permissions: PermissionId[] }) => Role;
  cloneRole: (sourceId: string, name: string) => Role | undefined;
  updateRole: (id: string, patch: Partial<Pick<Role, "name" | "description" | "permissions">>) => void;
  deleteRole: (id: string) => void;
}

let roleCounter = 0;
function nextRoleId(): string {
  roleCounter += 1;
  return `role-custom-${Date.now().toString(36)}-${roleCounter}`;
}

export const useRolesStore = create<RolesState>()(
  persist(
    (set, get) => ({
      customRoles: [],

      getAllRoles: () => [...SYSTEM_ROLES, ...get().customRoles],

      getRole: (id) => get().getAllRoles().find((r) => r.id === id),

      createRole: ({ name, description, permissions }) => {
        const role: Role = {
          id: nextRoleId(),
          name,
          description,
          system: false,
          permissions,
        };
        set((s) => ({ customRoles: [...s.customRoles, role] }));
        return role;
      },

      cloneRole: (sourceId, name) => {
        const source = get().getRole(sourceId);
        if (!source) return undefined;
        const role: Role = {
          id: nextRoleId(),
          name,
          description: `Cloned from ${source.name}`,
          system: false,
          permissions: [...source.permissions],
        };
        set((s) => ({ customRoles: [...s.customRoles, role] }));
        return role;
      },

      updateRole: (id, patch) =>
        set((s) => ({
          customRoles: s.customRoles.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        })),

      deleteRole: (id) =>
        set((s) => ({
          customRoles: s.customRoles.filter((r) => r.id !== id),
        })),
    }),
    {
      name: "wp-roles",
      version: 1,
      // Drop any permission ids that no longer exist (e.g. a permission was
      // renamed/removed) so a stale custom role can't grant invalid access.
      migrate: (persisted) => {
        const state = persisted as { customRoles?: Role[] } | undefined;
        const customRoles = (state?.customRoles ?? []).map((r) => ({
          ...r,
          permissions: r.permissions.filter((p) => VALID_PERMISSIONS.has(p)),
        }));
        return { customRoles } as RolesState;
      },
    },
  ),
);
