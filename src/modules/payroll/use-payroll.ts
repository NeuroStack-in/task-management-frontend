"use client";

/**
 * Payroll runs + deduction rules from the live backend, with draft/finalize actions. Totals are real
 * (comp − deductions); there are no per-employee payslips server-side, so the view never shows them.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  listRuns,
  getDeductions,
  draftRun,
  finalizeRun,
  updateDeductions,
  setCompensation,
  type ApiPayrollRun,
  type ApiDeduction,
  type ApiCompensation,
  type CompensationInput,
} from "./services/payroll.service";

export interface PayrollState {
  runs: ApiPayrollRun[];
  deductions: ApiDeduction[];
  /**
   * Set when the deduction rules could not be read. Kept apart from an empty list on purpose: the
   * card used to show a failed read as "No deduction rules configured", and since saving replaces
   * the whole document, the first edit from there wiped every real rule (WP-075).
   */
  deductionsError: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  draft: (period: string) => Promise<ApiPayrollRun>;
  finalize: (period: string) => Promise<ApiPayrollRun>;
  saveDeductions: (rules: ApiDeduction[]) => Promise<ApiDeduction[]>;
  setComp: (userId: string, body: CompensationInput) => Promise<ApiCompensation>;
}

export function usePayroll(): PayrollState {
  const [runs, setRuns] = useState<ApiPayrollRun[]>([]);
  const [deductions, setDeductions] = useState<ApiDeduction[]>([]);
  const [deductionsError, setDeductionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setDeductionsError(null);
    // A failed deductions read must not look like "no rules" — the runs list stays usable either way.
    const deductionsRead = getDeductions().then(
      (d) => ({ ok: true as const, d }),
      // The rules need `payroll:manage` on the server; a view-only role was told "No deduction
      // rules configured" beside run totals that plainly include deductions (WP-268).
      (e: unknown) => ({
        ok: false as const,
        message:
          e instanceof ApiError && e.status === 403
            ? "only payroll managers can see the deduction rules — the run totals above already include them."
            : messageOf(e),
      }),
    );
    Promise.all([listRuns(), deductionsRead])
      .then(([r, d]) => {
        if (!live) return;
        // Newest period first.
        setRuns([...r].sort((a, b) => b.period.localeCompare(a.period)));
        if (d.ok) setDeductions(d.d);
        else setDeductionsError(d.message);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const draft = useCallback(
    async (period: string) => {
      const run = await draftRun(period);
      reload();
      return run;
    },
    [reload],
  );

  const finalize = useCallback(
    async (period: string) => {
      const run = await finalizeRun(period);
      reload();
      return run;
    },
    [reload],
  );

  /** PUT the full rule list; the server echoes the stored list back — trust that echo. */
  const saveDeductions = useCallback(async (rules: ApiDeduction[]) => {
    const next = await updateDeductions(rules);
    setDeductions(next);
    return next;
  }, []);

  /** Set one employee's comp. Comp feeds run totals at *draft* time, so existing rows don't move —
   *  no reload needed; the PUT's echo is the freshest read the API offers (there is no comp GET). */
  const setComp = useCallback(async (userId: string, body: CompensationInput) => {
    return setCompensation(userId, body);
  }, []);

  return {
    runs,
    deductions,
    deductionsError,
    loading,
    error,
    reload,
    draft,
    finalize,
    saveDeductions,
    setComp,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to payroll.";
    return e.message;
  }
  return "Couldn't load payroll. Check your connection and retry.";
}
