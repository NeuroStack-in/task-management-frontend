/**
 * Billing — the real backend (`payroll-billing` context, LLD §1/§20).
 *
 * `GET /v1/billing` serves the org's live subscription: plan, seat cap, and seats actually consumed
 * (a counter kept by the seat EventBridge consumer). This is real money-adjacent state, not mock —
 * the dashboard's billing widget and seat gauge read it directly.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `payroll_billing::features::billing::data::BillingOverview`. */
export interface BillingOverview {
  /** `free` | `starter` | `business` | `enterprise`. */
  plan: string;
  /** `monthly` | `annual`. */
  cadence: string;
  /** Seats the plan permits. */
  seat_cap: number;
  /** Seats currently consumed (active members). */
  seats_used: number;
  /** `active` | `past_due` | `canceled` | … */
  status: string;
}

export function getBillingOverview(): Promise<BillingOverview> {
  return apiFetch<BillingOverview>("/v1/billing");
}

/**
 * The plans the server actually accepts — `payroll_billing::shared::parse_plan` maps exactly
 * `free | starter | enterprise`; anything else is a 400. Note the local `PLAN_TIERS` catalog in
 * `lib/mock-billing` also lists a `business` tier that the backend has **no** concept of, so it is
 * never offered as a switch target here.
 */
export const SERVER_PLANS = ["free", "starter", "enterprise"] as const;
export type ServerPlan = (typeof SERVER_PLANS)[number];

export function isServerPlan(plan: string): plan is ServerPlan {
  return (SERVER_PLANS as readonly string[]).includes(plan);
}

/** The cadences the stored subscription uses. The server echoes whatever it is given, defaulting
 *  to the existing cadence (or `monthly` for a fresh org) when omitted. */
export const BILLING_CADENCES = ["monthly", "annual"] as const;
export type BillingCadence = (typeof BILLING_CADENCES)[number];

/** Mirrors `payroll_billing::features::billing::ChangePlanRequest`. */
export interface ChangePlanRequest {
  plan: ServerPlan;
  /** Optional — omitted keeps the subscription's current cadence. */
  cadence?: BillingCadence;
}

/**
 * `POST /v1/billing/change-plan` — gated on `billing:manage`.
 *
 * This is the **head of the plan-change chain**: the handler writes the subscription item and emits
 * `billing.plan_changed`, which `identity` consumes to reconcile entitlements (and `fleet` reacts to
 * downstream). Seat cap is derived server-side from the plan, so a downgrade can leave `seats_used`
 * above the new `seat_cap` — the response reports both honestly rather than blocking.
 *
 * Payment is a **stub** server-side (it succeeds immediately; a real provider slots in behind the
 * same call), so there is no checkout/redirect step to model here. What the server does **not**
 * serve: proration, invoices, a payment method, or a cancellation/period-end concept — cancelling is
 * expressed as switching to the `free` plan, which is the only thing the backend supports.
 */
export function changePlan(req: ChangePlanRequest): Promise<BillingOverview> {
  return apiFetch<BillingOverview>("/v1/billing/change-plan", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
