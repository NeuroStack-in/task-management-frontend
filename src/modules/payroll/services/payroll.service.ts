/**
 * Payroll — the real backend (`payroll-billing` context, LLD §20).
 *
 * What the server serves is **totals per run**, each run's **per-employee lines** (the payslips it
 * publishes on finalize), and the **deduction rules**. A run is `{period, status, gross, deductions,
 * net}`; totals are computed at draft time from each employee's comp minus the deduction rules. **Hourly
 * staff are included**: their gross is `rate × every hour the timer recorded that month`, billable or
 * not (owner decision 2026-10-18, UX audit TIME-06 — it used to be billable hours only).
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
  /** Every tracked second in the month — hourly pay's basis (TIME-06), shown beside salaried pay too
   *  since 2026-10-28. Absent on older slips. */
  worked_secs?: number;
  /** The billable part — for invoicing, not pay. Absent for salaried pay. */
  billable_secs?: number;
  /** The month's scheduled days and what each was — salaried pay is prorated by them (loss of pay
   *  for absent days, owner decision 2026-10-28). Absent on runs drafted before it. */
  days?: DayCounts;
  gross: number;
  deductions: number;
  net: number;
}

/** A person's scheduled days in the month — mirrors `payroll-billing::shared::calendar::DayCounts`. */
export interface DayCounts {
  /** Days on the org's working week, holidays included — the denominator. */
  scheduled: number;
  worked: number;
  leave: number;
  holiday: number;
  /** Closed as absent — unpaid. */
  absent: number;
  /** Before the person joined — unpaid. */
  before_joining: number;
  /** Not closed yet — paid, as a preview. */
  upcoming: number;
  /** Past, with no attendance record — paid, flagged. */
  unrecorded: number;
}

/** An active person the run doesn't pay, with their pay as it stands now. */
export interface ApiNotOnRun {
  user_id: string;
  name: string;
  /** Absent when no pay is set — the usual reason. */
  pay_type?: string;
  rate?: number;
}

export interface ApiRunDetail extends ApiPayrollRun {
  lines: ApiRunLine[];
  /** Active people the run leaves out. Absent on servers from before 2026-10-28. */
  not_on_run?: ApiNotOnRun[];
  /**
   * The deduction rules this run was computed with, as they stood when it was drafted (UX audit
   * TIME-20). Absent on runs drafted before the server kept them.
   */
  rules?: { name: string; kind: "percent" | "flat" | string; value: number }[];
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
