/**
 * Roles & permissions — the real backend (`identity` context, LLD §13).
 *
 * This wires the **Roles admin page** to the server: it lists real roles and the real permission
 * catalog, and creates/edits/deletes/clones/assigns against live endpoints. The server is the true
 * boundary — a role's permissions are a `u128` bitset, surfaced here as its wire **ids** (e.g.
 * `activity:read:self`, `time:track:self`).
 *
 * ## Scope note (important)
 *
 * The app's *own* nav/route gating (`usePermissions` → `canAccess`) still runs off the local
 * `constants/permissions.ts` vocabulary keyed by `roleId`, **not** this catalog — the two use
 * different id vocabularies, and unifying them (projecting the JWT bitset through this catalog) is a
 * separate, larger change. So editing a role here changes what the **server** enforces (reflected in
 * the user's JWT on next sign-in); it does not retroactively rewrite the local UI gate. Owner is
 * `is_owner: true` with a near-empty bitset — never `permissions: ["*"]` (that wildcard is a flag
 * outside the capability space).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::list_roles::dto::RoleDto`. */
export interface ApiRole {
  id: string;
  name: string;
  description: string;
  /** `true` for the 3 built-in roles — can't be edited or deleted. */
  system: boolean;
  /** Owner wildcard flag (outside the bitset). Full access; permissions is near-empty. */
  is_owner: boolean;
  /** `self` | `team` | `org`. */
  scope: string;
  /** The permission wire ids this role grants. */
  permissions: string[];
}

/** Mirrors `identity::features::list_permissions::dto::PermissionDto`. */
export interface ApiPermission {
  id: string;
  module: string;
  label: string;
  /** View-prerequisite ids the server ORs in on save (the `implies` closure). */
  implies: string[];
}

export interface ApiPermissionGroup {
  module: string;
  label: string;
  permissions: ApiPermission[];
}

/** `GET /v1/permissions` — the server's catalog, camelCase on the wire. */
export interface ApiPermissionCatalog {
  groups: ApiPermissionGroup[];
  contributorOnly: string[];
}

/** Create/update body — the server closes the `implies` set and validates the ids server-side. */
export interface RolePayload {
  name: string;
  description: string;
  scope: string;
  permissions: string[];
}

export function listRoles(): Promise<ApiRole[]> {
  return apiFetch<{ roles: ApiRole[] }>("/v1/roles").then((r) => r.roles);
}

export function getPermissionCatalog(): Promise<ApiPermissionCatalog> {
  return apiFetch<ApiPermissionCatalog>("/v1/permissions");
}

export function createRole(body: RolePayload): Promise<ApiRole> {
  return apiFetch<ApiRole>("/v1/roles", { method: "POST", body: JSON.stringify(body) });
}

export function updateRole(id: string, body: RolePayload): Promise<ApiRole> {
  return apiFetch<ApiRole>(`/v1/roles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteRole(id: string): Promise<void> {
  await apiFetch(`/v1/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function cloneRole(id: string, name?: string): Promise<ApiRole> {
  return apiFetch<ApiRole>(`/v1/roles/${encodeURIComponent(id)}/clone`, {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
}

export async function assignRole(userId: string, roleId: string): Promise<void> {
  await apiFetch(`/v1/users/${encodeURIComponent(userId)}/role`, {
    method: "PUT",
    body: JSON.stringify({ role_id: roleId }),
  });
}
