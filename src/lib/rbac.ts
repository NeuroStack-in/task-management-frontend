import type { Role, PermissionId } from "@/types/rbac";
import type { FeatureKey } from "@/stores/features.store";
import { featureForHref } from "@/constants/features";
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
 * capabilities (e.g. `time-tracking:self`) — so oversight roles like Owner don't
 * inherit "I track my own time". Contributor-only perms must be listed.
 *
 * This mirrors `AuthContext::can` in wp-platform, which special-cases the same
 * carve-out (bits 110–119, `Permission::is_contributor_only`): `is_owner` wins
 * everywhere except that range. The server is the real boundary; this gate is UX.
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
  "time-tracking:manage",
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
  /**
   * The org's effective-feature predicate. Optional so callers that legitimately don't care about
   * entitlements (or run before they load) keep their current behaviour — omitting it gates on
   * permissions alone, exactly as before.
   */
  isFeatureOn?: (key: FeatureKey) => boolean,
  /**
   * The org's tracking-mode route hider (MANAGED-AGENT.md §4). Optional, same reasoning. Covers the
   * routes a mode hides that have **no** feature key (e.g. `/payroll`), which `isFeatureOn` can't.
   */
  isHrefHidden?: (href: string) => boolean,
  /**
   * Layer 3 — the org's page-visibility toggles. Optional so callers that predate it (or run before
   * entitlements hydrate) behave exactly as before: omitting it gates on plan + permission alone.
   */
  isPageOn?: (href: string) => boolean,
  /**
   * The plan ceiling (layer 1). When supplied, a feature the **plan doesn't include** stays *visible*
   * so it can be discovered and show an Upgrade prompt on click — the freemium path. A feature that is
   * in the plan but the org **toggled off** is still hidden. Omit it to keep the old behaviour (hide
   * anything not effectively on), which the `/insights` redirect and search rely on.
   */
  isFeatureAllowed?: (key: FeatureKey) => boolean,
): boolean {
  if (isFeatureOn) {
    const feature = featureForHref(item.href);
    if (feature && !isFeatureOn(feature)) {
      // "Disabled features are hidden from all users" — but only when the org actually *disabled* one
      // it has (in the plan, toggled off). A feature the PLAN doesn't include is shown instead (so the
      // user meets an Upgrade wall rather than a feature that silently doesn't exist) when the caller
      // opts in with `isFeatureAllowed`. Without that predicate, hide as before.
      const planLimited = isFeatureAllowed ? !isFeatureAllowed(feature) : false;
      if (!planLimited) return false;
    }
  }
  // A route the org's tracking mode hides is gone regardless of plan/role.
  if (isHrefHidden?.(item.href)) return false;
  // …and one the org has hidden outright. Owners are exempt inside `isPageOn`, so whoever can undo
  // the toggle can always still see the page.
  if (isPageOn && !isPageOn(item.href)) return false;
  if (item.anyPermissions) return canAny(role, item.anyPermissions);
  return canAccess(role, item.permission);
}

/**
 * Filters the navigation tree down to the items the role may access, dropping
 * empty groups. Used by the sidebar generator (TDD §8 — "navigation filtering").
 */
export function getAccessibleNav(
  role: Role | null | undefined,
  isFeatureOn?: (key: FeatureKey) => boolean,
  isHrefHidden?: (href: string) => boolean,
  isPageOn?: (href: string) => boolean,
  /** Plan ceiling — supply it so plan-limited features stay visible (Upgrade on click). See
   *  {@link isNavItemVisible}. */
  isFeatureAllowed?: (key: FeatureKey) => boolean,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      isNavItemVisible(role, item, isFeatureOn, isHrefHidden, isPageOn, isFeatureAllowed),
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * Can this role open `pathname`?
 *
 * **Use this, not `canAccess(role, permissionForPath(p))`.** That pairing silently allows any nav
 * entry gated by `anyPermissions` instead of a single `permission`, because `permissionForPath`
 * only reads the latter and `canAccess(role, null)` is `true`. The Analytics hub is exactly such an
 * entry, so `/insights` — and `/insights/anomalies` and `/insights/reports`, which have no tab of
 * their own and fall back to it — were reachable by anyone signed in, whatever the sidebar showed.
 *
 * Matches the most specific nav entry (longest `href`) and applies the same rule the sidebar does:
 * `anyPermissions` when present, else `permission`, and an unmatched path is open — a route nobody
 * registered is not a route this function gets to guess about.
 */
export function canAccessPath(
  role: Role | null | undefined,
  pathname: string,
): boolean {
  const item = navItemForPath(pathname);
  if (!item) return true;
  if (item.anyPermissions) return canAny(role, item.anyPermissions);
  return canAccess(role, item.permission);
}

/** The most specific registered nav entry for a path, across every surface that declares one. */
function navItemForPath(pathname: string): NavItem | null {
  const items: NavItem[] = [
    ...NAV_GROUPS.flatMap((g) => g.items),
    ...ADMIN_SECTIONS.flatMap((g) => g.items),
    ...ACCOUNT_SECTIONS,
    ...INSIGHTS_TABS,
  ];
  let match: NavItem | null = null;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!match || item.href.length > match.href.length) match = item;
    }
  }
  return match;
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
 * Where to send a user who has just authenticated, given the `?from=` the login page carried.
 *
 * `from` is **not** trustworthy as a destination. `AuthGuard` stamps it from whatever protected path
 * any *previous* session was bouncing off, and it survives in the URL across a sign-out — so an
 * owner kicked off `/settings/features` leaves that behind, and the next person to sign in on that
 * page is thrown at an admin screen their role can't open. The result is "Access denied" as the
 * first thing you see after a perfectly good login.
 *
 * So `from` is honoured only when the *newly signed-in* role can actually reach it; otherwise the
 * user lands on the dashboard, which every role can. Feature entitlements aren't consulted here —
 * they haven't loaded yet at redirect time, and `AuthGuard` covers that case with its own message.
 */
export function safeLandingPath(
  role: Role | null | undefined,
  from: string | null | undefined,
): string {
  // Must be a same-origin absolute path. `//evil.com` and `/\evil.com` both start with "/" yet are
  // protocol-relative URLs to another host — a redirect the attacker controls.
  if (!from || !from.startsWith("/") || /^\/[\\/]/.test(from)) return "/dashboard";
  return canAccessPath(role, from) ? from : "/dashboard";
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
