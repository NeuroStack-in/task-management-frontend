"use client";

/**
 * "People" — everyone on the selected run, and everyone it leaves out, from
 * `GET /v1/payroll/runs/{period}` (2026-10-28 rework).
 *
 * Each line shows the days behind the amount (salaried pay loses absent days, owner decision
 * 2026-10-28), the hours tracked, and what to check before finalizing. People with no pay set used to
 * vanish from the run with no word on the page; they are listed under it, with the fix one click away.
 * Finalize publishes each line as a payslip (UX audit TIME-02).
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Loader2, Pencil, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import {
  getRunDetail,
  type ApiPayrollRun,
  type ApiRunDetail,
} from "../services/payroll.service";
import { daysSummary, lineNotes, notOnRunReason, unpaidDays } from "../lib/pay-lines";
import type { PayTarget } from "./set-pay-dialog";

export function RunLinesCard({
  run,
  currency,
  canManage,
  reloadKey,
  onLoaded,
  onEditPay,
  onRedraft,
}: {
  run: ApiPayrollRun;
  currency?: string;
  canManage: boolean;
  /** Bumped by the page after a pay change, so the "not on this run" list re-reads. */
  reloadKey: number;
  /** The run's detail once read — the finalize confirm counts people and warnings from it. */
  onLoaded?: (detail: ApiRunDetail) => void;
  onEditPay: (target: PayTarget) => void;
  onRedraft?: () => void;
}) {
  const [detail, setDetail] = useState<ApiRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Re-read when the run changes — a redraft keeps the period but changes every number.
  const key = `${run.period}|${run.status}|${run.gross}|${run.net}|${reloadKey}`;
  const draft = run.status !== "final";

  useEffect(() => {
    let live = true;
    setError(null);
    getRunDetail(run.period).then(
      (d) => {
        if (!live) return;
        setDetail(d);
        onLoaded?.(d);
      },
      (e: unknown) => live && setError(friendlyError(e, "Couldn't load the people on this run.")),
    );
    return () => {
      live = false;
    };
    // `onLoaded` is a fresh closure each render; the read depends only on the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const money = (n: number) => formatCurrency(n, currency);
  const lines = detail?.period === run.period ? detail.lines : null;
  const missing = detail?.period === run.period ? (detail.not_on_run ?? []) : [];
  const rules = detail?.period === run.period ? detail.rules : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <p className="text-muted-foreground text-xs">
          {draft
            ? "What each person will be paid. Check the notes before finalizing — each line becomes their payslip."
            : "The payslips issued for this run."}
          {rules
            ? ` Deductions: ${
                rules.length === 0
                  ? "none"
                  : rules
                      .map((r) =>
                        r.kind === "percent"
                          ? `${r.name} ${r.value}% of gross`
                          : `${r.name} ${money(r.value)} each`,
                      )
                      .join(" · ")
              }.`
            : null}
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
        ) : (
          <>
            {lines.length === 0 ? (
              <p className="text-muted-foreground flex items-center gap-2 px-6 pb-4 text-sm">
                <Users className="size-4" /> Nobody is paid on this run yet — set people&apos;s pay
                below, then redraft.
              </p>
            ) : (
              <div
                // A named, focusable scroll region (UX audit TIME-15).
                className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                role="region"
                aria-label="People on this run"
                tabIndex={0}
              >
                <table className="w-full text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Employee</TableHead>
                      <TableHead>Pay</TableHead>
                      <TableHead>Days this month</TableHead>
                      <TableHead className="text-right">Hours tracked</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="pr-6 text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const notes = lineNotes(l);
                      return (
                        <TableRow key={l.user_id} className="align-top">
                          <TableCell className="pl-6">
                            <p className="font-medium">{l.name}</p>
                            {notes.length ? (
                              <ul className="mt-1 space-y-0.5">
                                {notes.map((n) => (
                                  <li
                                    key={n.text}
                                    className={cn(
                                      "flex items-start gap-1 text-xs",
                                      n.tone === "warning" ? "text-warning" : "text-muted-foreground",
                                    )}
                                  >
                                    {n.tone === "warning" ? (
                                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                    ) : (
                                      <Info className="mt-0.5 size-3 shrink-0" />
                                    )}
                                    {n.text}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="tabular-nums">{money(l.rate)}</span>
                            <span className="text-muted-foreground text-xs">
                              {l.pay_type === "hourly" ? "/h" : "/mo"}
                            </span>
                            {canManage && draft ? (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="ml-1 size-7"
                                aria-label={`Change ${l.name}'s pay`}
                                onClick={() =>
                                  onEditPay({
                                    user_id: l.user_id,
                                    name: l.name,
                                    pay_type: l.pay_type,
                                    rate: l.rate,
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            ) : null}
                            <p className="text-muted-foreground text-xs capitalize">{l.pay_type}</p>
                          </TableCell>
                          <TableCell className="text-xs">
                            {l.days ? (
                              <>
                                <p>{daysSummary(l.days)}</p>
                                {l.pay_type === "salaried" ? (
                                  <p className="text-muted-foreground">
                                    paid for {l.days.scheduled - unpaidDays(l.days)} of{" "}
                                    {l.days.scheduled}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.worked_secs != null ? formatHours(l.worked_secs / 3600) : "—"}
                            {l.pay_type === "hourly" && l.billable_secs != null ? (
                              <p className="text-muted-foreground text-xs">
                                {formatHours(l.billable_secs / 3600)} billable
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(l.gross)}</TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">
                            {money(l.deductions)}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-medium tabular-nums">
                            {money(l.net)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </table>
              </div>
            )}

            {missing.length ? (
              <div className="border-t px-6 py-4">
                <p className="text-sm font-medium">
                  Not on this run{" "}
                  <Badge variant="outline" className="ml-1 font-normal">
                    {missing.length}
                  </Badge>
                </p>
                <ul className="mt-2 divide-y">
                  {missing.map((p) => {
                    const why = notOnRunReason(p);
                    return (
                      <li key={p.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                        <span className="min-w-0 flex-1 text-sm">{p.name}</span>
                        <span className="text-muted-foreground text-xs">{why.text}</span>
                        {canManage && draft ? (
                          why.action === "set-pay" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEditPay({ user_id: p.user_id, name: p.name })}
                            >
                              <UserPlus className="size-4" /> Set pay
                            </Button>
                          ) : onRedraft ? (
                            <Button size="sm" variant="outline" onClick={onRedraft}>
                              Redraft
                            </Button>
                          ) : null
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
