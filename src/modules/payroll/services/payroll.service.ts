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
