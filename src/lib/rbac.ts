import type { Role, PermissionId } from "@/types/rbac";
import { WILDCARD, CONTRIBUTOR_ONLY_PERMISSIONS } from "@/constants/permissions";
import {
  NAV_GROUPS,
  ADMIN_SECTIONS,
  ACCOUNT_SECTIONS,
  INSIGHTS_TABS,
  type NavGroup,
  type NavItem,
} from "@/constants/navigation";

/**
 * Core access check (TDD §8). A null permission is always granted. An explicit
 * grant always wins. The wildcard "*" grants everything EXCEPT contributor-only
 * capabilities (e.g. `time-tracking:edit`) — so oversight roles like Owner don't
 * inherit "I track my own time". Contributor-only perms must be listed.
 */
export function canAccess(
  role: Role | null | undefined,
  permission: PermissionId | null,
): boolean {
  if (permission === null) return true;
  if (!role) return false;
  if (role.permissions.includes(permission)) return true;
  if (
    role.permissions.includes(WILDCARD) &&
    !CONTRIBUTOR_ONLY_PERMISSIONS.includes(permission)
  ) {
    return true;
  }
  return false;
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
 * Capabilities that only oversight/management roles hold. An individual
 * contributor (the Employee role) has none of these, which lets the UI tailor
 * personal settings (e.g. a simpler "Security" section without Billing) for the
 * employee interface while leaving the management interface unchanged.
 */
const MANAGEMENT_PERMISSIONS: PermissionId[] = [
  "settings:manage",
  "billing:view",
  "employees:manage",
  "roles:view",
  "security:view",
  "payroll:view",
  "time-tracking:approve",
  "approvals:view",
];

/** True for management/oversight roles; false for an individual contributor. */
export function isManagement(role: Role | null | undefined): boolean {
  return canAny(role, MANAGEMENT_PERMISSIONS);
}

/** Visibility for a nav item: by `anyPermissions` if present, else by `permission`. */
export function isNavItemVisible(
  role: Role | null | undefined,
  item: NavItem,
): boolean {
  if (item.anyPermissions) return canAny(role, item.anyPermissions);
  return canAccess(role, item.permission);
}

/**
 * Filters the navigation tree down to the items the role may access, dropping
 * empty groups. Used by the sidebar generator (TDD §8 — "navigation filtering").
 */
export function getAccessibleNav(role: Role | null | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavItemVisible(role, item)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Resolves the required permission for a given pathname. Scans the sidebar nav
 * AND the admin sections (which live in the Settings hub, not the sidebar) so
 * relocated routes stay guarded. Returns the most specific (longest href) match.
 */
export function permissionForPath(pathname: string): PermissionId | null {
  const items: NavItem[] = [
    ...NAV_GROUPS.flatMap((g) => g.items),
    ...ADMIN_SECTIONS.flatMap((g) => g.items),
    ...ACCOUNT_SECTIONS,
    ...INSIGHTS_TABS,
  ];
  let match: NavItem | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!match || item.href.length > match.href.length) {
        match = item;
      }
    }
  }
  return match?.permission ?? null;
}

/**
 * Resolves the page title for a given pathname by matching the most specific
 * nav entry (sidebar, admin hub, or Insights tab). Used to echo the active
 * page's name in the top navbar.
 */
export function titleForPath(pathname: string): string | null {
  const items: NavItem[] = [
    ...NAV_GROUPS.flatMap((g) => g.items),
    ...ADMIN_SECTIONS.flatMap((g) => g.items),
    ...INSIGHTS_TABS,
  ];
  let match: NavItem | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!match || item.href.length > match.href.length) {
        match = item;
      }
    }
  }
  return match?.label ?? null;
}
