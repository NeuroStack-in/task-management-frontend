/**
 * Deterministic mock data for Billing & Subscription (SPEC.md §3, section 22).
 * Server-safe. Plan, usage meters, invoices, and payment method for the Acme
 * demo org (Business plan).
 */

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

export const CURRENT_PLAN = {
  tierId: "business" as const,
  seatsUsed: 96,
  seatsTotal: 120,
  pricePerSeat: 20,
  renewsOn: "Jul 1, 2026",
  billingCycle: "Monthly" as const,
};

export interface UsageMeter {
  label: string;
  used: number;
  total: number;
  unit: string;
}

export const USAGE_METERS: UsageMeter[] = [
  { label: "Seats", used: 96, total: 120, unit: "seats" },
  { label: "Screenshot storage", used: 318, total: 500, unit: "GB" },
  { label: "API requests", used: 142_000, total: 250_000, unit: "req" },
  { label: "Data retention", used: 90, total: 365, unit: "days" },
];

export type InvoiceStatus = "paid" | "due" | "failed";

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: InvoiceStatus;
}

export const INVOICES: Invoice[] = [
  { id: "inv-6", number: "INV-2026-006", date: "Jun 1, 2026", amount: 2400, status: "paid" },
  { id: "inv-5", number: "INV-2026-005", date: "May 1, 2026", amount: 2400, status: "paid" },
  { id: "inv-4", number: "INV-2026-004", date: "Apr 1, 2026", amount: 2280, status: "paid" },
  { id: "inv-3", number: "INV-2026-003", date: "Mar 1, 2026", amount: 2280, status: "paid" },
  { id: "inv-2", number: "INV-2026-002", date: "Feb 1, 2026", amount: 2120, status: "paid" },
  { id: "inv-1", number: "INV-2026-001", date: "Jan 1, 2026", amount: 2120, status: "paid" },
];

export const PAYMENT_METHOD = {
  brand: "Visa",
  last4: "4242",
  expires: "08 / 27",
  name: "Acme Corporation",
};

/** Monthly spend trend for the sparkline (last 7 invoices, oldest → newest). */
export const SPEND_TREND = [2120, 2120, 2280, 2280, 2400, 2400, 2400];

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}
