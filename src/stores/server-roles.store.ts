import { create } from "zustand";
import type { Role } from "@/types/rbac";

/**
 * The org's roles **as the server defines them**, fetched once per session.
 *
 * Deliberately NOT persisted, unlike `wp-roles`. That store caches locally-created roles in
 * localStorage, which is exactly how the UI gate drifted from the server in the first place: a role
 * edited on the server never reached the browser, and a role created on one machine was invisible
 * on another. This one is session-scoped and always re-fetched, so the gate can only be as stale as
 * the current page load.
 *
 * `loaded` distinguishes "fetched, and the org genuinely has no custom roles" from "not fetched
 * yet" — the difference between showing a member their real (empty) nav and briefly showing them
 * nothing while a request is in flight.
 */
interface ServerRolesState {
  roles: Role[];
  loaded: boolean;
  /** Set when the fetch failed; the UI falls back to the built-in system roles. */
  error: string | null;
  setRoles: (roles: Role[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useServerRolesStore = create<ServerRolesState>()((set) => ({
  roles: [],
  loaded: false,
  error: null,
  setRoles: (roles) => set({ roles, loaded: true, error: null }),
  setError: (error) => set({ error, loaded: true }),
  reset: () => set({ roles: [], loaded: false, error: null }),
}));
