/**
 * RBAC type model.
 *
 * Permissions are identified by a stable string id of the form `<module>:<action>`
 * (e.g. "tasks:create"). Roles hold a list of permission ids. A role may hold the
 * wildcard "*" which grants every permission (used by the Organization Owner).
 *
 * See SPEC.md §5 and TDD.md §8.
 */

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "assign"
  | "manage"
  | "export"
  | "approve"
  | "request"
  /**
   * "I personally do this" — a contributor capability, not an oversight one.
   * Distinct from `edit`: it answers *do I do this myself?*, never *may I change
   * someone else's?*. See CONTRIBUTOR_ONLY_PERMISSIONS.
   */
  | "self";

export type PermissionId = string; // `${module}:${action}` or "*"

export interface Permission {
  id: PermissionId;
  module: string;
  action: PermissionAction;
  label: string;
}

export interface PermissionCategory {
  /** Module key, matches a route segment where applicable. */
  module: string;
  label: string;
  permissions: Permission[];
}

/**
 * Data-visibility scope for a role:
 * - `self` — only the user's own data (Employee).
 * - `team` — the user's own team (same department + team), e.g. a Team Lead / Manager.
 * - `org`  — the whole organisation (Owner / Admin / HR / Finance).
 * Defaults to `org` when unset.
 */
export type RoleScope = "self" | "team" | "org";

export interface Role {
  id: string;
  name: string;
  description: string;
  /** True for built-in system roles that cannot be deleted. */
  system: boolean;
  /** Permission ids, or ["*"] for full access. */
  permissions: PermissionId[];
  /** How much of the org's data this role can see. Defaults to `org`. */
  scope?: RoleScope;
}
