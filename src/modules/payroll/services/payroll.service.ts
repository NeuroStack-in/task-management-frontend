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

/**
 * `PUT /v1/payroll/deductions` — replace the org's deduction rules wholesale (the server stores the
 * list verbatim as the `CONFIG#DEDUCTIONS` document and echoes it back). Needs `payroll:manage`.
 */
export function updateDeductions(deductions: ApiDeduction[]): Promise<ApiDeduction[]> {
  return apiFetch<{ deductions: ApiDeduction[] }>("/v1/payroll/deductions", {
    method: "PUT",
    body: JSON.stringify({ deductions }),
  }).then((r) => r.deductions);
}

/** What `PUT /v1/payroll/comp/{user_id}` takes — mirrors `employee_comp::CompRequest`. */
export interface CompensationInput {
  /** `hourly` (rate = per hour) | `salaried` (rate = per month). Server rejects anything else. */
  pay_type: "hourly" | "salaried";
  /** Must be non-negative. */
  rate: number;
}

/** The PUT's echo — mirrors `employee_comp::CompView`. There is **no comp GET route**; this response
 *  is the only read of an employee's comp the API offers (runs consume it server-side at draft time). */
export interface ApiCompensation {
  user_id: string;
  pay_type: string;
  rate: number;
}

/**
 * `PUT /v1/payroll/comp/{user_id}` — set an employee's pay type + rate. Needs `payroll:manage`.
 * 404 if the user id doesn't exist in the tenant.
 */
export function setCompensation(
  userId: string,
  body: CompensationInput,
): Promise<ApiCompensation> {
  return apiFetch<ApiCompensation>(`/v1/payroll/comp/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
