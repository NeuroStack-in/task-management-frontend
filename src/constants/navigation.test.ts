import { describe, expect, it } from "vitest";

import { ALL_NAV_ITEMS, NAV_GROUPS, navItemForPath } from "./navigation";
import { SYSTEM_ROLES } from "./roles";
import { canAccessPath, getAccessibleNav } from "@/lib/rbac";

/**
 * `navItemForPath` is what tells the assistant which page the user is on. Getting it wrong is not a
 * crash — it is a confident answer about a different screen, which is exactly the bug this was
 * written for: asked "what is this page?" on Roles & Permissions, the assistant described
 * Attendance.
 */
describe("navItemForPath", () => {
  it("resolves an exact route to its navigation entry", () => {
    const item = navItemForPath("/settings/roles");
    expect(item?.href).toBe("/settings/roles");
    expect(item?.label).toBeTruthy();
  });

  /** **The load-bearing rule.** `/settings` also matches `/settings/roles` as a prefix; the more
   * specific entry has to win or every settings page answers as "Settings". */
  it("prefers the longest matching href", () => {
    const item = navItemForPath("/settings/roles");
    expect(item?.href).not.toBe("/settings");
  });

  /** A detail page is about the same thing as its list, so it should resolve rather than fall to
   * null and leave the assistant with only a raw path. */
  it("resolves a detail route to its section", () => {
    const item = navItemForPath("/employees/01ABCDEF");
    expect(item?.href).toBe("/employees");
  });

  it("ignores a trailing slash and a query string", () => {
    expect(navItemForPath("/dashboard/")?.href).toBe("/dashboard");
    expect(navItemForPath("/dashboard?range=7d")?.href).toBe("/dashboard");
  });

  /** An entry whose href carries a `#fragment` targets a scroll position, not a distinct page —
   * matching must use the path part or it never matches at all. */
  it("matches an entry whose href carries a fragment", () => {
    const withFragment = ALL_NAV_ITEMS.find((i) => i.href.includes("#"));
    if (!withFragment) return; // none today; the rule still holds if one is added
    const base = withFragment.href.split("#")[0];
    expect(navItemForPath(base)).not.toBeNull();
  });

  /** WP-328: a `#section` entry strips to its page's path; the page itself must win the tie. */
  it("prefers the page over a #section of it", () => {
    expect(navItemForPath("/settings/security")?.href).toBe("/settings/security");
    expect(navItemForPath("/settings/ownership")?.label).toBe("Ownership & deletion");
  });

  /** WP-509: search de-duplicates by href, so a second entry for the same href is never reachable. */
  it("declares every href once", () => {
    const hrefs = ALL_NAV_ITEMS.map((i) => i.href);
    expect(hrefs.filter((h, i) => hrefs.indexOf(h) !== i)).toEqual([]);
  });

  it("returns null for a route that is not in the navigation", () => {
    expect(navItemForPath("/definitely-not-a-page")).toBeNull();
  });

  /** The flat list is what the lookup searches; an empty one would silently disable page awareness
   * everywhere rather than failing loudly. */
  it("the flat list actually contains the app's sections", () => {
    expect(ALL_NAV_ITEMS.length).toBeGreaterThan(10);
    for (const href of ["/dashboard", "/employees", "/attendance"]) {
      expect(ALL_NAV_ITEMS.some((i) => i.href === href)).toBe(true);
    }
  });
});

/**
 * SHELL-04 regrouped the sidebar so every group label is true for every role that sees it. Only the
 * grouping moved: this pins each entry's gate, so a later regroup can't quietly change who may open
 * a page (route gating reads these same entries — `canAccessPath`).
 */
describe("sidebar groups (UX audit SHELL-04)", () => {
  const gates = Object.fromEntries(
    NAV_GROUPS.flatMap((g) => g.items).map((i) => [
      i.href,
      i.anyPermissions ? `any:${i.anyPermissions.join(",")}` : String(i.permission),
    ]),
  );

  it("keeps every entry's gate exactly as it was", () => {
    expect(gates).toEqual({
      "/dashboard": "dashboard:view",
      "/time-tracking": "time-tracking:view",
      "/projects": "projects:view",
      "/attendance": "attendance:view",
      "/leave-requests": "any:leave:view,leave:manage",
      "/employees": "employees:view",
      "/approvals": "approvals:view",
      "/payroll": "payroll:view",
      "/insights": "any:activity:view,screenshots:view,ai:view",
      "/settings": "null",
      "/help": "help:view",
      "/notifications": "notifications:view",
    });
  });

  it("gives an Employee no oversight heading and no one-item group", () => {
    const employee = SYSTEM_ROLES.find((r) => r.id === "role-employee")!;
    const groups = getAccessibleNav(employee).map((g) => ({
      label: g.label,
      footer: g.placement === "footer",
      sidebar: g.items.filter((i) => i.inSidebar !== false).map((i) => i.href),
    }));
    expect(groups).toEqual([
      { label: "Work", footer: false, sidebar: ["/dashboard", "/time-tracking", "/projects"] },
      { label: "Attendance & leave", footer: false, sidebar: ["/attendance", "/leave-requests"] },
      { label: "General", footer: true, sidebar: ["/settings", "/help"] },
    ]);
  });

  it("still gates /notifications though the sidebar no longer lists it", () => {
    const noBell = { ...SYSTEM_ROLES.find((r) => r.id === "role-employee")!, permissions: [] };
    expect(canAccessPath(noBell, "/notifications")).toBe(false);
    expect(canAccessPath(SYSTEM_ROLES.find((r) => r.id === "role-employee")!, "/notifications")).toBe(
      true,
    );
  });
});
