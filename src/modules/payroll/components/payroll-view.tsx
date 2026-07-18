"use client";

import { useMemo, useState } from "react";
import { Wallet, Banknote, Receipt, Plus, CheckCircle2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { usePayroll } from "../use-payroll";
import type { ApiPayrollRun } from "../services/payroll.service";

const STATUS_META: Record<string, string> = {
  draft: "bg-warning/15 text-warning",
  final: "bg-success/12 text-success",
};
const statusMeta = (s: string) => STATUS_META[s] ?? "bg-muted text-muted-foreground";

/** YYYY-MM → "August 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function deductionLabel(kind: string, value: number): string {
  return kind === "percent" ? `${value}%` : formatCurrency(value);
}

export function PayrollView() {
  const { can } = usePermissions();
  const canManage = can("payroll:manage");
  const { runs, deductions, loading, error, reload, draft, finalize } = usePayroll();

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState("");
  const [busy, setBusy] = useState(false);

  const selected: ApiPayrollRun | null = useMemo(() => {
    if (!runs.length) return null;
    return runs.find((r) => r.period === selectedPeriod) ?? runs[0];
  }, [runs, selectedPeriod]);

  async function handleDraft() {
    const p = newPeriod.trim();
    if (!/^\d{4}-\d{2}$/.test(p)) {
      toast.error("Enter a period as YYYY-MM, e.g. 2026-09.");
      return;
    }
    setBusy(true);
    try {
      const run = await draft(p);
      setSelectedPeriod(run.period);
      setNewPeriod("");
      toast.success(`Drafted ${periodLabel(run.period)}`, {
        description: `Gross ${formatCurrency(run.gross)} · net ${formatCurrency(run.net)}`,
      });
    } catch {
      toast.error("Couldn't draft the run. It may already exist.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize(period: string) {
    setBusy(true);
    try {
      await finalize(period);
      toast.success(`Finalized ${periodLabel(period)}`);
    } catch {
      toast.error("Couldn't finalize the run.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && runs.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading payroll…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Payroll" description="Pay runs and deductions." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description={
          selected
            ? `${periodLabel(selected.period)} · ${selected.status}`
            : "Pay runs and deductions."
        }
      />

      {/* Selected run totals */}
      {selected ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Net pay" value={formatCurrency(selected.net)} icon={Wallet} hint={periodLabel(selected.period)} featured />
          <StatCard label="Gross pay" value={formatCurrency(selected.gross)} icon={Banknote} hint={`${formatCurrency(selected.deductions)} deductions`} />
          <StatCard label="Deductions" value={formatCurrency(selected.deductions)} icon={Receipt} hint={`${deductions.length} rules`} />
          <StatCard label="Status" value={selected.status === "final" ? "Final" : "Draft"} icon={CheckCircle2} hint={selected.status === "final" ? "settled" : "not settled"} />
        </div>
      ) : null}

      {/* Draft a new run */}
      {canManage ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium">Draft a pay run</p>
            <p className="text-xs text-muted-foreground">
              Computes totals from each employee&apos;s comp minus the deduction rules below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
              placeholder="2026-09"
              className="w-32"
            />
            <Button onClick={handleDraft} disabled={busy}>
              <Plus className="size-4" /> Draft run
            </Button>
          </div>
        </div>
      ) : null}

      {/* Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Pay runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No pay runs yet"
              description={canManage ? "Draft a run above to get started." : "Pay runs will appear here."}
              className="m-4 border-0"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    {canManage ? <TableHead className="pr-6 text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow
                      key={r.period}
                      className={cn("cursor-pointer", r.period === selected?.period && "bg-muted/40")}
                      onClick={() => setSelectedPeriod(r.period)}
                    >
                      <TableCell className="pl-6 font-medium">{periodLabel(r.period)}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", statusMeta(r.status))}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.gross)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(r.deductions)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.net)}</TableCell>
                      {canManage ? (
                        <TableCell className="pr-6 text-right">
                          {r.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFinalize(r.period);
                              }}
                            >
                              Finalize
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader>
          <CardTitle>Deduction rules</CardTitle>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deduction rules configured.</p>
          ) : (
            <ul className="divide-y">
              {deductions.map((d) => (
                <li key={d.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium capitalize">{d.name}</span>
                    {!d.active ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        inactive
                      </Badge>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">{deductionLabel(d.kind, d.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Honest gap */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <MonitorSmartphone className="size-4 shrink-0" />
        Totals are comp-based. Per-employee payslips and hours-based pay need tracked-hours data from
        the desktop agent, which isn&apos;t flowing yet — so they aren&apos;t shown.
      </div>
    </div>
  );
}
