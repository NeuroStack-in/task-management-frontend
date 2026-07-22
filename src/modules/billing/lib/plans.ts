/**
 * Static pricing/plan catalog for Billing & Subscription (SPEC.md §3, section 22).
 *
 * The ids and seat caps mirror the backend — `wp_contracts::plans::Plan` is `free | starter |
 * enterprise` (there is **no** `business` plan; `parse_plan` rejects it with a 400) and the caps
 * come from `payroll_billing::shared::seat_cap`. Feature bullets track `Plan::allowed()`. Prices
 * are display copy only; the server bills nothing (no payment provider).
 */

export interface PlanTier {
  id: "free" | "starter" | "enterprise";
  name: string;
  pricePerSeat: number;
  /** Mirrors `payroll_billing::shared::seat_cap`. */
  seatCap: number;
  blurb: string;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    pricePerSeat: 0,
    seatCap: 5,
    blurb: "For trying WorkPulse out.",
    features: ["Up to 5 seats", "Time tracking & attendance", "Leave & projects", "Basic reports"],
  },
  {
    id: "starter",
    name: "Starter",
    pricePerSeat: 8,
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
    pricePerSeat: 35,
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
