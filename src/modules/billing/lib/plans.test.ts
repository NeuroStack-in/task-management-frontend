import { describe, expect, it } from "vitest";
import { PLANS as SIGNUP_PLANS } from "@/modules/auth/components/auth-modals";
import { PRICING as LANDING_PRICING } from "@/modules/marketing/landing/content";
import { membersLabel, PLAN_TIERS, tierOf } from "./plans";

/**
 * WP-105 (QA audit 2026-10-08): the public pricing, the landing page, the sign-up picker and in-app
 * Billing each kept their own prices, seat limits and feature lists, and disagreed with each other
 * and with the server. They now read the catalog; this pins that they keep doing so.
 */
describe("one pricing catalog", () => {
  it("carries the server's seat caps", () => {
    expect(PLAN_TIERS.map((t) => [t.id, t.seatCap])).toEqual([
      ["free", 5],
      ["starter", 25],
      ["enterprise", 1000],
    ]);
  });

  it("is what the sign-up picker charges and promises", () => {
    for (const p of SIGNUP_PLANS) {
      const t = tierOf(p.id as "free" | "starter" | "enterprise");
      expect(p.monthly).toBe(t.pricePerSeat);
      expect(p.annual).toBe(t.annualPerSeat);
      expect(p.features).toContain(membersLabel(t.id));
    }
  });

  it("is what the landing page charges and promises", () => {
    for (const p of LANDING_PRICING) {
      const t = PLAN_TIERS.find((x) => x.name === p.name)!;
      expect(p.price).toBe(`$${t.pricePerSeat}`);
      expect(p.features).toContain(membersLabel(t.id));
    }
  });

  /** Free and Starter cannot switch screenshots or AI on (`Plan::allowed`), so nothing may sell them. */
  it("never sells an Enterprise-only capability on a lower plan", () => {
    const lower = [
      ...SIGNUP_PLANS.filter((p) => p.id !== "enterprise").flatMap((p) => p.features),
      ...LANDING_PRICING.filter((p) => p.name !== "Enterprise").flatMap((p) => p.features),
    ];
    for (const f of lower) {
      expect(f).not.toMatch(/screenshot|\bAI\b|anomal|unlimited members/i);
    }
  });
});
