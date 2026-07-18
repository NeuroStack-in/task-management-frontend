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
  type ApiPayrollRun,
  type ApiDeduction,
} from "./services/payroll.service";

export interface PayrollState {
  runs: ApiPayrollRun[];
  deductions: ApiDeduction[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  draft: (period: string) => Promise<ApiPayrollRun>;
  finalize: (period: string) => Promise<ApiPayrollRun>;
}

export function usePayroll(): PayrollState {
  const [runs, setRuns] = useState<ApiPayrollRun[]>([]);
  const [deductions, setDeductions] = useState<ApiDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([listRuns(), getDeductions().catch(() => [])])
      .then(([r, d]) => {
        if (!live) return;
        // Newest period first.
        setRuns([...r].sort((a, b) => b.period.localeCompare(a.period)));
        setDeductions(d);
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

  return { runs, deductions, loading, error, reload, draft, finalize };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to payroll.";
    return e.message;
  }
  return "Couldn't load payroll. Check your connection and retry.";
}
