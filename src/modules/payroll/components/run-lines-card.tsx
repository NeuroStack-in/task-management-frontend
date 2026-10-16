"use client";

/**
 * "Pay per employee" — every person's line on the selected run, read from
 * `GET /v1/payroll/runs/{period}`.
 *
 * Finalize publishes each of these as a payslip, and the page used to show only the org totals
 * beforehand, so a wrong rate or a missing person was found by the employee, after the fact (UX audit
 * 2026-10-16, TIME-02). Shown for drafts and finals alike: a final run's lines are the issued pay.
 */
import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";
import { formatHours } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import {
  getRunDetail,
  type ApiPayrollRun,
  type ApiRunLine,
} from "../services/payroll.service";

export function RunLinesCard({
  run,
  currency,
  onLoaded,
}: {
  run: ApiPayrollRun;
  currency?: string;
  /** How many people the run pays, once read — the finalize confirm says it. */
  onLoaded?: (count: number) => void;
}) {
  const [lines, setLines] = useState<ApiRunLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Re-read when the run changes — a redraft keeps the period but changes every number.
  const key = `${run.period}|${run.status}|${run.gross}|${run.net}`;

  useEffect(() => {
    let live = true;
    setLines(null);
    setError(null);
    getRunDetail(run.period).then(
      (d) => {
        if (!live) return;
        setLines(d.lines ?? []);
        onLoaded?.((d.lines ?? []).length);
      },
      (e: unknown) =>
        live && setError(friendlyError(e, "Couldn't load the pay per employee.")),
    );
    return () => {
      live = false;
    };
    // `onLoaded` is a fresh closure each render; the read depends only on the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const money = (n: number) => formatCurrency(n, currency);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay per employee</CardTitle>
        <p className="text-muted-foreground text-xs">
          {run.status === "final"
            ? "The payslips issued for this run."
            : "What each person will be paid. Check it before finalizing — each line becomes their payslip."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="flex items-center justify-between gap-3 px-6 pb-5 text-sm">
            <span className="text-muted-foreground">{error}</span>
            <Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}>
              Retry
            </Button>
          </div>
        ) : lines === null ? (
          <p className="text-muted-foreground flex items-center gap-2 px-6 pb-5 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : lines.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 px-6 pb-5 text-sm">
            <Users className="size-4" /> Nobody is paid on this run — set compensation
            below, then draft it again.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Employee</TableHead>
                  <TableHead>Pay type</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Billable hours</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="pr-6 text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.user_id}>
                    <TableCell className="pl-6 font-medium">{l.name}</TableCell>
                    <TableCell className="capitalize">{l.pay_type || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(l.rate)}
                      <span className="text-muted-foreground text-xs">
                        {l.pay_type === "hourly" ? "/h" : "/mo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.pay_type === "hourly" && l.billable_secs != null
                        ? formatHours(l.billable_secs / 3600)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(l.gross)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {money(l.deductions)}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">
                      {money(l.net)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
