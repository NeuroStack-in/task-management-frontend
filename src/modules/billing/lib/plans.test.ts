import { describe, expect, it } from "vitest";
import { PLANS as SIGNUP_PLANS } from "@/modules/auth/components/auth-modals";
import { PRICING as LANDING_PRICING } from "@/modules/marketing/landing/content";
import { PUBLIC_PLANS } from "@/modules/marketing/pricing/content";
import {
  annualSaving,
  cadenceOf,
  downgradeLoss,
  FEATURE_LABELS,
  membersLabel,
  PLAN_TIERS,
  priceFor,
  tierOf,
} from "./plans";

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

  it("is what /pricing promises", () => {
    expect(PUBLIC_PLANS.map((p) => p.id)).toEqual(PLAN_TIERS.map((t) => t.id));
    for (const p of PUBLIC_PLANS) {
      expect(p.name).toBe(tierOf(p.id).name);
      expect(p.features).toContain(membersLabel(p.id));
    }
  });

  /** Free and Starter cannot switch screenshots or AI on (`Plan::allowed`), so nothing may sell them. */
  it("never sells an Enterprise-only capability on a lower plan", () => {
    const lower = [
      ...SIGNUP_PLANS.filter((p) => p.id !== "enterprise").flatMap((p) => p.features),
      ...LANDING_PRICING.filter((p) => p.name !== "Enterprise").flatMap((p) => p.features),
      ...PUBLIC_PLANS.filter((p) => p.id !== "enterprise").flatMap((p) => p.features),
    ];
    for (const f of lower) {
      expect(f).not.toMatch(/screenshot|\bAI\b|anomal|unlimited members/i);
    }
  });
});

/** UX audit 2026-10-16, SET-09 / SET-10. */
describe("cadence and downgrades", () => {
  it("prices a tier for its cadence, and reads anything but annual as monthly", () => {
    const starter = tierOf("starter");
    expect(priceFor(starter, "monthly")).toBe(12);
    expect(priceFor(starter, "annual")).toBe(10);
    expect(annualSaving(starter)).toBe(17);
    expect(annualSaving(tierOf("free"))).toBe(0);
    expect(cadenceOf("annual")).toBe("annual");
    expect(cadenceOf("yearly")).toBe("monthly");
    expect(cadenceOf(undefined)).toBe("monthly");
  });

  it("mirrors Plan::allowed — each plan contains the one below it", () => {
    expect(tierOf("enterprise").allowed).toEqual(Object.keys(FEATURE_LABELS));
    for (const k of tierOf("free").allowed) expect(tierOf("starter").allowed).toContain(k);
    expect(tierOf("starter").allowed).not.toContain("monitoring.screenshots");
  });

  it("names what a downgrade switches off, apart from what was never on", () => {
    const on = new Set(["monitoring.screenshots", "ai.assistant", "monitoring.activity"]);
    const loss = downgradeLoss(tierOf("enterprise"), tierOf("starter"), (k) => on.has(k));
    expect(loss.switchedOff).toEqual(["monitoring.screenshots", "ai.assistant"]);
    expect(loss.unavailable).toEqual(["insights.reports.ai_pdf", "ai.insights", "anomalies"]);
    expect(loss.seatCap).toBe(25);
  });

  it("loses nothing on an upgrade", () => {
    const loss = downgradeLoss(tierOf("free"), tierOf("enterprise"), () => true);
    expect(loss).toEqual({ switchedOff: [], unavailable: [], seatCap: null });
  });
});
