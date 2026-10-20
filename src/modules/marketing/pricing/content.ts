/**
 * What `/pricing` sells. Moved out of the page (2026-10-15) so the plan cards — now a client island
 * with a monthly/annual switch — and the server-rendered table read one list, and so `plans.test.ts`
 * can hold this page to the catalog the way it holds the landing and the sign-up picker.
 *
 * The three tiers mirror `Plan` in `crates/wp-contracts/src/plans.rs`: `free | starter | enterprise`.
 * Prices and seat caps come from `modules/billing/lib/plans.ts`; nothing here is a literal price.
 */
import { CalendarCheck, Clock, KeyRound, ScrollText, type LucideIcon } from "lucide-react";
import { PLAN_TIERS, membersLabel, type PlanTier } from "@/modules/billing/lib/plans";

export interface PublicPlan {
  id: PlanTier["id"];
  name: string;
  tagline: string;
  features: string[];
  cta: string;
  featured: boolean;
}

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For individuals and very small teams getting started.",
    features: ["Time tracking, timesheets & attendance", "Leave, approvals & projects", "Basic reports", membersLabel("free")],
    cta: "Get started free",
    featured: false,
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For growing teams that need real insight.",
    features: ["Everything in Free", "Activity & productivity analytics", "App & website usage", "Slack integration", membersLabel("starter")],
    cta: "Choose Starter",
    featured: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations operating at scale.",
    features: ["Everything in Starter", "Screenshot review", "AI insights, assistant & PDF reports", "Anomaly detection", membersLabel("enterprise")],
    cta: "Choose Enterprise",
    featured: true,
  },
];

/**
 * The largest annual saving across the paid tiers, as a whole percent (Starter $12 → $10 is 17%,
 * Enterprise $22 → $18 is 18%). Computed, so the switch and the FAQ can't quote a number the catalog
 * doesn't support.
 */
export const ANNUAL_SAVING_PCT = Math.max(
  ...PLAN_TIERS.filter((t) => t.pricePerSeat > 0).map((t) =>
    Math.round((1 - t.annualPerSeat / t.pricePerSeat) * 100),
  ),
);

type Cell = string | boolean;

/**
 * What the server's plan catalog (`Plan::allowed`) actually enables — nothing here may be sold that a
 * plan cannot switch on. A row true on every plan also appears in the "on every plan" strip, with
 * its icon.
 */
export const COMPARISON: { label: string; values: [Cell, Cell, Cell]; icon?: LucideIcon }[] = [
  { label: "Time tracking & timesheets", values: [true, true, true], icon: Clock },
  { label: "Members", values: [membersLabel("free"), membersLabel("starter"), membersLabel("enterprise")] },
  { label: "Attendance, leave & projects", values: [true, true, true], icon: CalendarCheck },
  { label: "Activity & productivity analytics", values: [false, true, true] },
  { label: "App & website usage", values: [false, true, true] },
  { label: "Slack integration", values: [false, true, true] },
  { label: "Screenshot review", values: [false, false, true] },
  { label: "Reports", values: ["Basic", "Basic", "Basic + AI PDF"] },
  { label: "AI insights, assistant & anomaly detection", values: [false, false, true] },
  { label: "Google sign-in", values: [true, true, true], icon: KeyRound },
  { label: "Audit log & custom roles", values: [true, true, true], icon: ScrollText },
];

/** The rows every plan carries — the "on every plan" strip. */
export const ON_EVERY_PLAN = COMPARISON.filter((r) => r.values.every((v) => v === true));

export const BILLING_FAQS = [
  {
    q: "How does per-seat billing work?",
    a: `Prices are per active member per month; annual billing saves up to ${ANNUAL_SAVING_PCT}%. While WorkPulse is in beta every plan is free — nothing is billed.`,
  },
  { q: "Is there really a free plan?", a: "Yes — Free stays free for up to 5 members. During the beta, Starter and Enterprise are free too, with no card required." },
  { q: "Can I change plans later?", a: "Yes, any time, from Settings → Billing. A plan can't be changed to one with fewer seats than you already use." },
  { q: "What does Enterprise add?", a: "Screenshot review, AI insights and the assistant, PDF reports and anomaly detection, for up to 1,000 members. Talk to us about anything larger." },
];
