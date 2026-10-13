/**
 * **The** pricing/plan catalog — Billing & Subscription, the public `/pricing` page, the landing
 * page's pricing section and the sign-up plan picker all read their prices and seat limits from
 * here (SPEC.md §3, section 22).
 *
 * They used to keep their own copies and disagreed: `/pricing` sold Starter at $12 with unlimited
 * members and screenshots, Billing then showed $8 for up to 25 seats, and the 26th invite and the
 * Screenshots toggle were refused (QA audit 2026-10-08, WP-105). One list, checked by
 * `plans.test.ts` against every surface.
 *
 * The ids and seat caps mirror the backend — `wp_contracts::plans::Plan` is `free | starter |
 * enterprise` (there is **no** `business` plan; `parse_plan` rejects it with a 400) and the caps
 * are `Plan::seat_cap`. Feature bullets track `Plan::allowed()`. Prices are display copy only; the
 * server bills nothing (no payment provider), and every plan is free while in beta.
 */

export interface PlanTier {
  id: "free" | "starter" | "enterprise";
  name: string;
  /** Per seat per month, billed monthly. */
  pricePerSeat: number;
  /** Per seat per month, billed annually. */
  annualPerSeat: number;
  /** Mirrors `Plan::seat_cap`. */
  seatCap: number;
  blurb: string;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    pricePerSeat: 0,
    annualPerSeat: 0,
    seatCap: 5,
    blurb: "For trying WorkPulse out.",
    features: ["Up to 5 seats", "Time tracking & attendance", "Leave & projects", "Basic reports"],
  },
  {
    id: "starter",
    name: "Starter",
    pricePerSeat: 12,
    annualPerSeat: 10,
    seatCap: 25,
    blurb: "For small teams getting started.",
    features: [
      "Up to 25 seats",
      "Everything in Free",
      "Activity monitoring",
      "Email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricePerSeat: 22,
    annualPerSeat: 18,
    seatCap: 1000,
    blurb: "For organizations with advanced needs.",
    features: [
      "Up to 1,000 seats",
      "Screenshots & anomaly detection",
      "AI insights & assistant",
      "Priority support",
    ],
  },
];

/** A tier by id — every surface prices from this rather than its own literal. */
export function tierOf(id: PlanTier["id"]): PlanTier {
  const t = PLAN_TIERS.find((p) => p.id === id);
  if (!t) throw new Error(`unknown plan ${id}`);
  return t;
}

/** `"Up to 25 members"` — the seat limit in marketing words, from the cap the server enforces. */
export function membersLabel(id: PlanTier["id"]): string {
  return `Up to ${tierOf(id).seatCap.toLocaleString("en-US")} members`;
}
