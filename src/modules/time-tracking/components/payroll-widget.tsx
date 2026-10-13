"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { useOrgCurrency } from "@/hooks/use-org";
import { formatCurrency } from "@/lib/currency";
import { formatHours } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { getMyPayslips, type MyPayslip } from "../services/payslips.service";

/** `2026-09` → "September 2026"; anything else as given. */
function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Personal pay, beside the weekly-hours chart on the personal Time Tracking view: the employee's own
 * **finalized** payslips (`GET /v1/me/payslips`), newest first.
 *
 * Until the owner's decision of 2026-10-09 there was no self-service payslip route, so this card
 * could only say "ask HR" (QA audit 2026-10-08, WP-376 / WP-424). Drafts never appear — the server
 * serves a slip only once its run is final — and nothing is estimated.
 */
export function PayrollWidget() {
  const currency = useOrgCurrency() ?? undefined;
  const [slips, setSlips] = useState<MyPayslip[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setError(null);
    getMyPayslips().then(
      (s) => live && setSlips(s),
      (e: unknown) =>
        live &&
        setError(e instanceof ApiError ? e.message : "Couldn't load your payslips."),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  const money = (n: number) => formatCurrency(n, currency);

  if (error) {
    return (
      <Card className="flex h-full flex-col">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (slips === undefined) {
    return (
      <Card className="flex h-full flex-col">
        <CardContent className="flex flex-1 items-center justify-center">
          <Loader label="Loading payslips…" />
        </CardContent>
      </Card>
    );
  }
  if (slips === null || slips.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardContent className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Wallet}
            title="No payslips yet"
            description={
              slips === null
                ? "Payslips aren't available on this server yet. Ask your HR or payroll team for yours."
                : "Your payslip appears here once payroll for a month is finalized. You'll get a notification when it's ready."
            }
            className="border-0"
          />
        </CardContent>
      </Card>
    );
  }

  const [latest, ...earlier] = slips;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Payslips</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <p className="text-muted-foreground text-xs">
            {monthLabel(latest.period)} · net pay
          </p>
          <p className="text-2xl font-semibold tabular-nums">{money(latest.net)}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Gross</dt>
            <dd className="text-right tabular-nums">{money(latest.gross)}</dd>
            <dt className="text-muted-foreground">Deductions</dt>
            <dd className="text-right tabular-nums">−{money(latest.deductions)}</dd>
            {latest.pay_type === "hourly" && typeof latest.billable_secs === "number" ? (
              <>
                <dt className="text-muted-foreground">Hours paid</dt>
                <dd className="text-right tabular-nums">
                  {formatHours(latest.billable_secs / 3600)} × {money(latest.rate)}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
        {earlier.length > 0 ? (
          <ul className="divide-y border-t text-sm">
            {earlier.slice(0, 5).map((s) => (
              <li key={s.period} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">{monthLabel(s.period)}</span>
                <span className="tabular-nums">{money(s.net)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
