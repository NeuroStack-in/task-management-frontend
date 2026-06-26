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
  | "request";

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

export interface Role {
  id: string;
  name: string;
  description: string;
  /** True for built-in system roles that cannot be deleted. */
  system: boolean;
  /** Permission ids, or ["*"] for full access. */
  permissions: PermissionId[];
}
