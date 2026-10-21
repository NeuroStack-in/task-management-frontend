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
  /**
   * Mirrors `Plan::allowed()` — the feature keys an owner may switch on under this plan. What a
   * downgrade switches off is the difference (`identity::apply_plan_change` force-clears every
   * enabled key the new plan doesn't allow), so the confirmation can name it (UX audit SET-09).
   */
  allowed: readonly FeatureKeyId[];
  blurb: string;
  features: string[];
}

/** `wp_contracts::plans::FEATURE_KEYS`, in that order, with the names Settings → Features uses. */
export const FEATURE_LABELS = {
  "time.tracking": "Time tracking",
  attendance: "Attendance",
  leave: "Leave",
  projects: "Projects & tasks",
  "reports.basic": "Reports",
  "insights.reports.ai_pdf": "AI report export (PDF)",
  "monitoring.activity": "Activity monitoring",
  "monitoring.screenshots": "Screenshots",
  "ai.insights": "AI insights",
  "ai.assistant": "AI assistant",
  anomalies: "Anomaly detection",
  integrations: "Integrations",
} as const;
export type FeatureKeyId = keyof typeof FEATURE_LABELS;

const ALL_FEATURES = Object.keys(FEATURE_LABELS) as FeatureKeyId[];

/** `monthly` | `annual` — the subscription's billing cadence (`BillingOverview.cadence`). */
export type Cadence = "monthly" | "annual";

/** The server's cadence string, read leniently: anything but `annual` is monthly (its default). */
export function cadenceOf(v: string | null | undefined): Cadence {
  return v === "annual" ? "annual" : "monthly";
}

/** Per seat per month on that cadence — annual is billed yearly at a lower monthly rate. */
export function priceFor(t: PlanTier, cadence: Cadence): number {
  return cadence === "annual" ? t.annualPerSeat : t.pricePerSeat;
}

/** Whole-percent saving of annual over monthly for a tier, or 0 for a free one. */
export function annualSaving(t: PlanTier): number {
  return t.pricePerSeat > 0 ? Math.round((1 - t.annualPerSeat / t.pricePerSeat) * 100) : 0;
}

/**
 * What moving from `from` to `to` takes away: the features the new plan doesn't allow (in catalog
 * order), split by whether the org has them switched on now — those stop for everyone the moment
 * the plan changes — and the seat cap when it shrinks.
 */
export function downgradeLoss(
  from: PlanTier,
  to: PlanTier,
  enabled: (key: FeatureKeyId) => boolean,
): { switchedOff: FeatureKeyId[]; unavailable: FeatureKeyId[]; seatCap: number | null } {
  const lost = from.allowed.filter((k) => !to.allowed.includes(k));
  return {
    switchedOff: lost.filter((k) => enabled(k)),
    unavailable: lost.filter((k) => !enabled(k)),
    seatCap: to.seatCap < from.seatCap ? to.seatCap : null,
  };
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    pricePerSeat: 0,
    annualPerSeat: 0,
    seatCap: 5,
    allowed: ["time.tracking", "attendance", "leave", "projects", "reports.basic"],
    blurb: "For trying WorkPulse out.",
    features: ["Up to 5 seats", "Time tracking & attendance", "Leave & projects", "Basic reports"],
  },
  {
    id: "starter",
    name: "Starter",
    pricePerSeat: 12,
    annualPerSeat: 10,
    seatCap: 25,
    allowed: [
      "time.tracking",
      "attendance",
      "leave",
      "projects",
      "reports.basic",
      "monitoring.activity",
      "integrations",
    ],
    blurb: "For small teams getting started.",
    features: [
      "Up to 25 seats",
      "Everything in Free",
      "Activity monitoring",
      "Support tickets",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    pricePerSeat: 22,
    annualPerSeat: 18,
    seatCap: 1000,
    // `Plan::Enterprise => FEATURE_KEYS` — everything.
    allowed: ALL_FEATURES,
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
