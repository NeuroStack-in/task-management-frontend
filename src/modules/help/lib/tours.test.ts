/**
 * Guards on the tour data.
 *
 * These exist because of a real failure: the Analytics tour pointed at `/analytics` and
 * `nav:/analytics`, but the sidebar links `/insights` and there is no `/analytics` page. Nothing
 * caught it — a wrong route or target isn't a type error, it's a step that silently waits for an
 * element that will never appear. The tour looked like it hung.
 *
 * A `data-tour` attribute on a page can't be checked without rendering it, but the two things that
 * broke *can* be checked cheaply: sidebar targets resolve to real nav entries, and every route is
 * one the router could actually serve.
 */
import { describe, expect, it } from "vitest";

import { SAFE_TARGET_PREFIXES, TOURS } from "./tours";
import { NAV_GROUPS } from "@/constants/navigation";

const steps = Object.values(TOURS).flatMap((t) =>
  t.steps.map((s) => ({ ...s, tour: t.id })),
);
const navHrefs = new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)));

describe("tour data", () => {
  it("has at least one step per tour", () => {
    for (const [id, tour] of Object.entries(TOURS)) {
      expect(tour.steps.length, `tour "${id}" is empty`).toBeGreaterThan(0);
      expect(tour.id, `tour "${id}" has a mismatched id`).toBe(id);
    }
  });

  /** The exact bug: `nav:/analytics` when the sidebar links `/insights`. */
  it("only points at sidebar items that exist", () => {
    for (const s of steps) {
      if (!s.target?.startsWith("nav:")) continue;
      const href = s.target.slice("nav:".length);
      expect(
        navHrefs.has(href),
        `tour "${s.tour}" targets nav:${href}, which is not in NAV_GROUPS`,
      ).toBe(true);
    }
  });

  /**
   * The bug that broke this twice: a marker placed inside one role's branch of a page.
   *
   * `/dashboard`, `/time-tracking` and `/attendance` all render a different component for a manager
   * than for an employee, so a target inside one branch is simply absent for everyone on the other
   * — and the step waits for an element that can never appear. Only targets verified present for
   * every role are allowed.
   */
  it("only uses targets verified to exist for every role", () => {
    for (const s of steps) {
      expect(
        SAFE_TARGET_PREFIXES.some((p) => s.target === p || s.target.startsWith(p)),
        `tour "${s.tour}" targets "${s.target}", which is not a verified-safe target ` +
          `(${SAFE_TARGET_PREFIXES.join(", ")}). Prove it renders in EVERY role branch of its ` +
          `page before adding it.`,
      ).toBe(true);
    }
  });

  /**
   * Every step gets a spotlight. A targetless step renders as a bare centred dialog, which reads as
   * a different and lesser thing than the rest of the tour.
   */
  it("spotlights every step", () => {
    for (const s of steps) {
      expect(s.target?.trim().length, `a step in "${s.tour}" has no target`).toBeGreaterThan(0);
    }
  });

  /**
   * `/insights` has no content of its own — it is a client redirect that `router.replace`s to the
   * first tab the role can open. A step routed there lands on a loader and is then navigated out
   * from under itself, so its target can never resolve. Steps must name the real tab.
   */
  it("never routes a step at a redirect-only page", () => {
    const REDIRECT_ONLY = ["/insights"];
    for (const s of steps) {
      expect(
        REDIRECT_ONLY.includes(s.route),
        `tour "${s.tour}" routes to ${s.route}, which only redirects — name the real tab instead`,
      ).toBe(false);
    }
  });

  it("uses absolute in-app routes", () => {
    for (const s of steps) {
      expect(s.route, `tour "${s.tour}" has an empty route`).toBeTruthy();
      expect(
        s.route.startsWith("/"),
        `tour "${s.tour}" route "${s.route}" is not absolute`,
      ).toBe(true);
      expect(
        s.route.includes("://"),
        `tour "${s.tour}" route "${s.route}" is external`,
      ).toBe(false);
    }
  });

  /**
   * Every step needs words. A step with no title renders an empty card, which reads as the tour
   * having broken rather than having nothing to say.
   */
  it("gives every step a title and content", () => {
    for (const s of steps) {
      expect(s.title.trim().length, `a step in "${s.tour}" has no title`).toBeGreaterThan(0);
      expect(s.content.trim().length, `"${s.title}" has no content`).toBeGreaterThan(0);
    }
  });

  /**
   * The card's gate and the steps' gates must agree.
   *
   * The Help Center shows a walkthrough card when the caller holds `tour.permission`. If every step
   * needed something *more* than that, the card would open a tour with zero steps — a button that
   * visibly does nothing. So: someone holding exactly the tour's own permission (and nothing else)
   * must get at least one step.
   */
  it("gives anyone who can see the card at least one step", () => {
    for (const [id, tour] of Object.entries(TOURS)) {
      const holds = (p?: string) => !p || p === tour.permission;
      expect(
        tour.steps.filter((s) => holds(s.permission)).length,
        `"${id}" is offered to ${tour.permission ?? "everyone"}, but every step needs more than that`,
      ).toBeGreaterThan(0);
    }
  });
});
