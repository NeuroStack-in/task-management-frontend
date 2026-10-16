/**
 * Payroll — the real backend (`payroll-billing` context, LLD §20).
 *
 * What the server serves is **totals per run**, each run's **per-employee lines** (the payslips it
 * publishes on finalize), and the **deduction rules**. A run is `{period, status, gross, deductions,
 * net}`; totals are computed at draft time from each employee's comp minus the deduction rules. **Hourly staff are included**: their gross is
 * `rate × billable hours the timer recorded that month` (`payroll_runs::compute_totals`) — time on
 * non-billable projects pays nothing. (This header used to say hours-based pay was not part of the
 * totals; QA audit 2026-10-08, WP-271.)
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

/** One person's pay on a run — the payslip finalizing publishes to them. */
export interface ApiRunLine {
  user_id: string;
  name: string;
  /** `hourly` | `salaried`. */
  pay_type: string;
  rate: number;
  /** Billable seconds hourly pay was computed from; absent for salaried pay. */
  billable_secs?: number;
  gross: number;
  deductions: number;
  net: number;
}

export interface ApiRunDetail extends ApiPayrollRun {
  lines: ApiRunLine[];
}

/**
 * `GET /v1/payroll/runs/{period}` — the run with **every employee's line**, so a run can be checked
 * person by person before it is finalized (UX audit 2026-10-16, TIME-02).
 */
export function getRunDetail(period: string): Promise<ApiRunDetail> {
  return apiFetch<ApiRunDetail>(`/v1/payroll/runs/${encodeURIComponent(period)}`);
}

/** `GET /v1/payroll/runs` — every run's totals. */
export function listRuns(): Promise<ApiPayrollRun[]> {
  return apiFetch<{ runs: ApiPayrollRun[] }>("/v1/payroll/runs").then((r) => r.runs);
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
