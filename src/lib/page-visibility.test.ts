import { describe, expect, it } from "vitest";

/**
 * Layer 3 — page visibility. The rule `useIsPageOn` applies, extracted so it can be tested without
 * mounting React or a store.
 *
 * Two properties matter more than the happy path:
 *
 *  - **Absent means visible.** A page nobody has toggled has no stored entry, and a renamed route
 *    must fail OPEN rather than silently disappearing. This layer sits on top of permission and
 *    plan gates that already deny properly; it is a preference, not a security boundary.
 *  - **Longest prefix wins.** Hiding `/insights` should hide its tabs without listing each one,
 *    while a single tab must still be hideable on its own.
 */
function isPageOn(
  pages: Record<string, boolean>,
  href: string,
  isOwner = false,
): boolean {
  if (isOwner) return true;
  if (["/dashboard", "/settings"].some((p) => href === p || href.startsWith(`${p}/`))) {
    return true;
  }
  let hidden = false;
  let best = -1;
  for (const [key, on] of Object.entries(pages)) {
    if ((href === key || href.startsWith(`${key}/`)) && key.length > best) {
      best = key.length;
      hidden = !on;
    }
  }
  return !hidden;
}

describe("page visibility", () => {
  it("a page nobody toggled is visible", () => {
    expect(isPageOn({}, "/projects")).toBe(true);
    expect(isPageOn({ "/payroll": false }, "/projects")).toBe(true);
  });

  it("hiding a page hides it", () => {
    expect(isPageOn({ "/payroll": false }, "/payroll")).toBe(false);
  });

  it("the home page and the settings page can never be hidden", () => {
    // Both are escape hatches: /dashboard is where every "back" button goes, /settings is where
    // the switch to undo it lives. A stored `false` for either must be ignored, not obeyed.
    expect(isPageOn({ "/dashboard": false }, "/dashboard")).toBe(true);
    expect(isPageOn({ "/settings": false }, "/settings/features")).toBe(true);
  });

  it("hiding a parent hides its tabs", () => {
    const pages = { "/insights": false };
    expect(isPageOn(pages, "/insights")).toBe(false);
    expect(isPageOn(pages, "/insights/activity")).toBe(false);
  });

  /** Longest prefix wins in BOTH directions — this is the half a naive check gets wrong. */
  it("a tab can be hidden while its parent stays visible", () => {
    const pages = { "/insights": true, "/insights/locations": false };
    expect(isPageOn(pages, "/insights")).toBe(true);
    expect(isPageOn(pages, "/insights/activity")).toBe(true);
    expect(isPageOn(pages, "/insights/locations")).toBe(false);
  });

  it("a tab can stay visible while its parent is hidden", () => {
    const pages = { "/insights": false, "/insights/activity": true };
    expect(isPageOn(pages, "/insights/activity")).toBe(true);
    expect(isPageOn(pages, "/insights/screenshots")).toBe(false);
  });

  /** A prefix must not match a sibling that merely starts with the same characters. */
  it("does not match a lookalike sibling", () => {
    expect(isPageOn({ "/leave": false }, "/leave-requests")).toBe(true);
    expect(isPageOn({ "/settings": false }, "/settings-export")).toBe(true);
  });

  /** Owners are exempt, or an org could hide a page with nobody able to bring it back. */
  it("owners see everything", () => {
    const pages = { "/payroll": false, "/insights": false };
    expect(isPageOn(pages, "/payroll", true)).toBe(true);
    expect(isPageOn(pages, "/insights/activity", true)).toBe(true);
  });

  /** The assistant is a launcher, not a route, so it carries a pseudo-key in the same namespace. */
  it("handles the assistant pseudo-key", () => {
    expect(isPageOn({ "page:assistant": false }, "page:assistant")).toBe(false);
    expect(isPageOn({}, "page:assistant")).toBe(true);
  });
});
