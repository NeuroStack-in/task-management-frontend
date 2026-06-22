import type { Role, PermissionId } from "@/types/rbac";
import { WILDCARD } from "@/constants/permissions";
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/constants/navigation";

/**
 * Core access check (TDD §8). Returns true when the role holds the wildcard or
 * the specific permission id. A null permission is always granted.
 */
export function canAccess(
  role: Role | null | undefined,
  permission: PermissionId | null,
): boolean {
  if (permission === null) return true;
  if (!role) return false;
  if (role.permissions.includes(WILDCARD)) return true;
  return role.permissions.includes(permission);
}

/** True if the role holds every listed permission. */
export function canAll(
  role: Role | null | undefined,
  permissions: PermissionId[],
): boolean {
  return permissions.every((perm) => canAccess(role, perm));
}

/** True if the role holds at least one of the listed permissions. */
export function canAny(
  role: Role | null | undefined,
  permissions: PermissionId[],
): boolean {
  return permissions.some((perm) => canAccess(role, perm));
}

/**
 * Filters the navigation tree down to the items the role may access, dropping
 * empty groups. Used by the sidebar generator (TDD §8 — "navigation filtering").
 */
export function getAccessibleNav(role: Role | null | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item: NavItem) =>
      canAccess(role, item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Resolves the required permission for a given pathname, if any nav item matches. */
export function permissionForPath(pathname: string): PermissionId | null {
  let match: NavItem | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        // Prefer the most specific (longest) matching href.
        if (!match || item.href.length > match.href.length) {
          match = item;
        }
      }
    }
  }
  return match?.permission ?? null;
}
