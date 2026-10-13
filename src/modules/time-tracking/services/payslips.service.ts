/**
 * The signed-in employee's own **finalized** payslips — `GET /v1/me/payslips` (payroll-billing).
 *
 * Self-service: no payroll permission needed, and drafts are never served (the server keeps only a
 * slip whose run is final and that belongs to that run). Added with the owner's decision to show
 * employees their payslips (QA audit 2026-10-08, WP-424).
 */
import { ApiError, apiFetch } from "@/lib/api";

/** Mirrors `payroll_billing::features::my_payslips::Payslip`. */
export interface MyPayslip {
  /** `YYYY-MM`. */
  period: string;
  /** `hourly` | `salaried`. */
  pay_type: string;
  rate: number;
  gross: number;
  deductions: number;
  net: number;
  /** Billable seconds an hourly payslip was computed from. */
  billable_secs?: number;
  /** When the run was finalized (epoch ms). */
  finalized_at?: number;
}

/** Newest first. `null` when the server predates the route (404) — the card then says so. */
export async function getMyPayslips(): Promise<MyPayslip[] | null> {
  try {
    const res = await apiFetch<{ payslips: MyPayslip[] }>("/v1/me/payslips");
    return res.payslips;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
