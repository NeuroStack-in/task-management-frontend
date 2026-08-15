import { describe, expect, it } from "vitest";

import { ALL_NAV_ITEMS, navItemForPath } from "./navigation";

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
