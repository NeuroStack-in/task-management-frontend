/**
 * Payroll — the real backend (`payroll-billing` context, LLD §20).
 *
 * What the server serves is **org totals per run** plus the **deduction rules** — not per-employee
 * payslips. A run is `{period, status, gross, deductions, net}`; totals are computed from each
 * employee's configured comp minus the deduction rules at draft time. Hours-based pay (per-person
 * tracked hours → gross) is deliberately **not** here — it needs Dev A's `TimeEntry`, which this
 * context can't read — so the view shows comp-based totals honestly, not invented payslips.
 */
import { apiFetch } from "@/lib/api";

/** `active` labels are the server's; `draft` | `final`. */
export interface ApiPayrollRun {
  period: string;
  status: string;
  gross: number;
  deductions: number;
  net: number;
}

export interface ApiDeduction {
  active: boolean;
  /** `percent` | `flat`. */
  kind: string;
  name: string;
  value: number;
}

export function listRuns(): Promise<ApiPayrollRun[]> {
  return apiFetch<{ runs: ApiPayrollRun[] }>("/v1/payroll/runs").then((r) => r.runs);
}

export function getRun(period: string): Promise<ApiPayrollRun> {
  return apiFetch<ApiPayrollRun>(`/v1/payroll/runs/${encodeURIComponent(period)}`);
}

/** `POST /v1/payroll/runs` — draft a run for `period` (YYYY-MM); computes totals from comp+deductions. */
export function draftRun(period: string): Promise<ApiPayrollRun> {
  return apiFetch<ApiPayrollRun>("/v1/payroll/runs", {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}

/** `POST /v1/payroll/runs/{period}/finalize`. */
export function finalizeRun(period: string): Promise<ApiPayrollRun> {
  return apiFetch<ApiPayrollRun>(`/v1/payroll/runs/${encodeURIComponent(period)}/finalize`, {
    method: "POST",
  });
}

export function getDeductions(): Promise<ApiDeduction[]> {
  return apiFetch<{ deductions: ApiDeduction[] }>("/v1/payroll/deductions").then(
    (r) => r.deductions,
  );
}

// ── Employee compensation (LLD §20) ───────────────────────────────────────────────────────────
//
// Comp is what a draft run's totals are computed from: `pay_type` + `rate` stamped on the employee's
// `USER#` record. There is **no read endpoint** — the server exposes only the write, so this module
// can never show an employee's *current* rate; the editor sets a value rather than editing one.
//
// Sensitivity note: `wp-platform/src/mask.rs` defines a field mask meant to strip comp fields from
// callers without `payroll:read`, but it is **never invoked** by any handler today. Nothing is
// hidden server-side by that mechanism, so the UI must gate on `payroll:manage` itself — which it
// does — rather than relying on the server to redact.

/** The pay types the server accepts (`employee_comp::handler` rejects anything else 400). */
export const PAY_TYPES = ["hourly", "salaried"] as const;
export type PayType = (typeof PAY_TYPES)[number];

/** Mirrors `payroll_billing::features::employee_comp::CompRequest`. */
export interface SetCompRequest {
  pay_type: PayType;
  /** Non-negative. Hourly rate or annual/period salary depending on `pay_type` — the server stores
   *  the number as given and does not attach a currency or a period label. */
  rate: number;
}

/** Mirrors `payroll_billing::features::employee_comp::CompView`. */
export interface ApiEmployeeComp {
  user_id: string;
  pay_type: string;
  rate: number;
}

/**
 * `PUT /v1/payroll/comp/{user_id}` — set an employee's pay type + rate. Gated on `payroll:manage`.
 *
 * The handler reads the employee's `USER#` item first, so an unknown user is a **404**. Validation
 * is server-side: `pay_type` must be `hourly|salaried` and `rate` must be non-negative (both 400).
 */
export function setEmployeeComp(
  userId: string,
  req: SetCompRequest,
): Promise<ApiEmployeeComp> {
  return apiFetch<ApiEmployeeComp>(
    `/v1/payroll/comp/${encodeURIComponent(userId)}`,
    { method: "PUT", body: JSON.stringify(req) },
  );
}
