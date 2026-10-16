"use client";

import { useMemo, useState } from "react";
import { Wallet, Banknote, Receipt, Plus, CheckCircle2, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useOrgCurrency } from "@/hooks/use-org";
import { cn } from "@/lib/utils";
import { usePayroll } from "../use-payroll";
import { DeductionsCard } from "./deductions-card";
import { SetCompensationCard } from "./set-compensation-card";
import { RunLinesCard } from "./run-lines-card";
import type { ApiPayrollRun } from "../services/payroll.service";

const STATUS_META: Record<string, string> = {
  draft: "bg-warning/15 text-warning",
  final: "bg-success/12 text-success",
};
const statusMeta = (s: string) => STATUS_META[s] ?? "bg-muted text-muted-foreground";

/** This month as `YYYY-MM`, in the viewer's clock — the server re-decides in the org's. */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Whether a period's month is over — only then can it be finalized (owner decision 2026-10-17, UX
 * audit TIME-02). Finalizing freezes hourly pay at the hours tracked so far, and publishes payslips.
 */
export function monthHasEnded(period: string, now: string = thisMonth()): boolean {
  return period < now;
}

/** YYYY-MM → "August 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function PayrollView() {
  // Every amount in the org's own currency (WP-078).
  const currency = useOrgCurrency() ?? undefined;
  const { can } = usePermissions();
  const canManage = can("payroll:manage");
  const {
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
  } = usePayroll();

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState("");
  const [busy, setBusy] = useState(false);
  /** The period awaiting a confirmed Finalize — finalizing is not reversible (WP-270). */
  const [confirmPeriod, setConfirmPeriod] = useState<string | null>(null);
  /** How many people the selected run pays — from its lines, once loaded. Said in the confirm. */
  const [linesCount, setLinesCount] = useState<{ period: string; count: number } | null>(null);

  const selected: ApiPayrollRun | null = useMemo(() => {
    if (!runs.length) return null;
    return runs.find((r) => r.period === selectedPeriod) ?? runs[0];
  }, [runs, selectedPeriod]);

  // Publish the selected pay run's figures to the assistant.
  useAssistantPageContext({
    facts: [
      { label: "Pay runs", value: String(runs.length) },
      ...(selected
        ? [
            { label: "Selected period", value: periodLabel(selected.period) },
            { label: "Status", value: selected.status === "final" ? "Final" : "Draft" },
            { label: "Net pay", value: formatCurrency(selected.net, currency) },
            { label: "Gross pay", value: formatCurrency(selected.gross, currency) },
            { label: "Deductions", value: formatCurrency(selected.deductions, currency) },
          ]
        : []),
    ],
  });

  async function handleDraft() {
    const p = newPeriod.trim();
    // A real month only — "2026-13" used to pass, sort above December, read as "January 2027" and
    // stay forever (no delete route). The server now checks too (WP-269).
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) {
      toast.error("Enter a period as YYYY-MM, e.g. 2026-09.");
      return;
    }
    setBusy(true);
    try {
      const run = await draft(p);
      setSelectedPeriod(run.period);
      setNewPeriod("");
      toast.success(`Drafted ${periodLabel(run.period)}`, {
        description: `Gross ${formatCurrency(run.gross, currency)} · net ${formatCurrency(run.net, currency)}`,
      });
    } catch (e) {
      // An existing *draft* is simply recomputed — only a finalized period refuses, so "It may
      // already exist" sent people looking for a problem that isn't one (QA audit 2026-10-08, WP-480).
      toast.error(
        e instanceof ApiError && e.status === 409
          ? `${periodLabel(p)} is already finalized — a finalized run can't be redrafted.`
          : e instanceof ApiError
            ? e.message
            : "Couldn't draft the run.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize(period: string) {
    setBusy(true);
    try {
      await finalize(period);
      toast.success(`Finalized ${periodLabel(period)}`, {
        description: "Each employee on the run can now open their payslip.",
      });
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === "period_not_ended"
          ? `${periodLabel(period)} isn't over yet — finalize it once the month has ended.`
          : "Couldn't finalize the run.",
      );
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
        actions={<RefreshButton onRefresh={reload} refreshing={loading} />}
      />

      {/* Selected run totals */}
      {selected ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Net pay" value={formatCurrency(selected.net, currency)} icon={Wallet} hint={periodLabel(selected.period)} featured />
          <StatCard label="Gross pay" value={formatCurrency(selected.gross, currency)} icon={Banknote} hint={`${formatCurrency(selected.deductions, currency)} deductions`} />
          <StatCard label="Deductions" value={formatCurrency(selected.deductions, currency)} icon={Receipt} hint={`${deductions.length} rules`} />
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
              aria-label="Pay period (YYYY-MM)"
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
                      {/* A real toggle, so a run can be selected by keyboard and the selection is
                          announced — the row's click and its tint were mouse- and colour-only
                          (WP-478). */}
                      <TableCell className="pl-6 font-medium">
                        <button
                          type="button"
                          aria-pressed={r.period === selected?.period}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPeriod(r.period);
                          }}
                          className="text-left hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {periodLabel(r.period)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", statusMeta(r.status))}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.gross, currency)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCurrency(r.deductions, currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.net, currency)}</TableCell>
                      {canManage ? (
                        <TableCell className="pr-6 text-right">
                          {r.status === "draft" && !monthHasEnded(r.period) ? (
                            // A month still running is a preview, not pay (TIME-02).
                            <span className="text-xs text-muted-foreground">
                              Finalize after the month ends
                            </span>
                          ) : r.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Show the person-by-person lines behind the confirm.
                                setSelectedPeriod(r.period);
                                setConfirmPeriod(r.period);
                              }}
                            >
                              Review &amp; finalize
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

      {/* Every employee's line on the selected run — what Finalize publishes, checked first (TIME-02). */}
      {selected ? (
        <RunLinesCard
          run={selected}
          currency={currency}
          onLoaded={(count) => setLinesCount({ period: selected.period, count })}
        />
      ) : null}

      {/* Compensation (write-only surface — the API has no comp GET) */}
      {canManage ? <SetCompensationCard onSave={setComp} /> : null}

      {/* Deductions — editable for payroll:manage, read-only otherwise */}
      <DeductionsCard
        deductions={deductions}
        loadError={deductionsError}
        onRetry={reload}
        canManage={canManage}
        onSave={saveDeductions}
      />

      {/* How the totals are made — the server does include hourly pay, from billable timer hours only,
          which this note used to deny (QA audit 2026-10-08, WP-271). */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <MonitorSmartphone className="size-4 shrink-0" />
        Salaried staff count at their monthly salary. Hourly staff count at their rate × the billable
        hours their timer recorded that month — time on non-billable projects isn&apos;t paid. Each
        employee&apos;s payslip is published to them when the run is finalized.
      </div>
      {/* A finalized run is the pay record of the period — it cannot be edited or regenerated
          afterwards, so one stray click on a row must not produce one (QA audit 2026-10-08, WP-270). */}
      <Dialog open={confirmPeriod !== null} onOpenChange={(open) => !open && setConfirmPeriod(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalize {confirmPeriod ? periodLabel(confirmPeriod) : ""}?</DialogTitle>
            {/* Say what Finalize actually does: it publishes payslips and notifies people. This said
                only that it "locks this run" (UX audit 2026-10-16, TIME-02). */}
            <DialogDescription>
              {linesCount && linesCount.period === confirmPeriod
                ? `${linesCount.count} ${linesCount.count === 1 ? "employee" : "employees"} will receive a payslip and be notified. `
                : "Every employee on this run will receive a payslip and be notified. "}
              Check the lines under Pay per employee first — a finalized run can&apos;t be edited or
              regenerated afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPeriod(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                const p = confirmPeriod;
                if (!p) return;
                await handleFinalize(p);
                setConfirmPeriod(null);
              }}
            >
              Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
