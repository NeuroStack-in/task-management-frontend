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
  /** `free` | `starter` | `enterprise` (`wp_contracts::plans::Plan`). */
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

/** Mirrors `payroll_billing::features::billing::ChangePlanRequest`. */
export interface ChangePlanRequest {
  /** `free` | `starter` | `enterprise` — the server rejects anything else (400). */
  plan: string;
  /** `monthly` | `annual`. Omitted → the subscription's current cadence is kept. */
  cadence?: string;
}

/**
 * Switch the org's plan — `POST /v1/billing/change-plan` (permission: `billing:manage` /
 * `Permission::BillingManage`).
 *
 * There is no payment provider: the server applies the change immediately ("payment_stub") and
 * returns the updated overview. It also emits `billing.plan_changed`, which `identity` consumes to
 * reconcile the org's **entitlements** — that hop is async (EventBridge), so entitlements readers
 * may briefly lag the plan shown here.
 */
export function changePlan(req: ChangePlanRequest): Promise<BillingOverview> {
  return apiFetch<BillingOverview>("/v1/billing/change-plan", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
