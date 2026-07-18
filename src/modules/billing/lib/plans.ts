/** Static pricing/plan catalog for Billing & Subscription (SPEC.md §3, section 22). */

export interface PlanTier {
  id: "free" | "starter" | "business" | "enterprise";
  name: string;
  pricePerSeat: number;
  blurb: string;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    pricePerSeat: 8,
    blurb: "For small teams getting started.",
    features: ["Up to 25 seats", "Time tracking", "Basic reports", "Email support"],
  },
  {
    id: "business",
    name: "Business",
    pricePerSeat: 20,
    blurb: "For growing teams that need insights.",
    features: [
      "Unlimited seats",
      "Activity & screenshots",
      "Anomaly detection",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricePerSeat: 35,
    blurb: "For organizations with advanced needs.",
    features: [
      "SSO & SCIM",
      "Audit logs & SOC 2",
      "Dedicated CSM",
      "Custom contracts",
    ],
  },
];
