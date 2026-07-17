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
