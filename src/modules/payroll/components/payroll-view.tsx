"use client";

/**
 * Payroll — one flow (2026-10-28 rework): pick a month → check everyone's pay → finalize.
 *
 * It was four summary cards, a separate "Draft a pay run" box, a runs table, a pay-per-employee table
 * that silently left out anyone with no pay set, and a write-only compensation card at the bottom.
 * Now the month picker is the run picker, every active person is on the page (paid, or "not on this
 * run" with the reason and the fix), each line shows the days behind it — salaried pay loses absent
 * days (owner decision 2026-10-28) — and pay is set from the person's row.
 */
import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useOrgCurrency } from "@/hooks/use-org";
import { cn } from "@/lib/utils";
import { usePayroll } from "../use-payroll";
import { DeductionsCard } from "./deductions-card";
import { RunLinesCard } from "./run-lines-card";
import { SetPayDialog, type PayTarget } from "./set-pay-dialog";
import type { ApiRunDetail } from "../services/payroll.service";
import { lastCompletedPeriod, periodLabel, recentPeriods } from "../lib/periods";
import { lineNotes } from "../lib/pay-lines";

/** This month as `YYYY-MM`, in the viewer's clock — the server re-decides in the org's. */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Whether a period's month is over — only then can it be finalized (owner decision 2026-10-17, UX
 * audit TIME-02). Finalizing freezes pay at what was recorded, and publishes payslips.
 */
export function monthHasEnded(period: string, now: string = thisMonth()): boolean {
  return period < now;
}

export function PayrollView() {
  // Every amount in the org's own currency (WP-078).
  const currency = useOrgCurrency() ?? undefined;
  const { can } = usePermissions();
  const canManage = can("payroll:manage");
  const { runs, deductions, deductionsError, loading, error, reload, draft, finalize, saveDeductions, setComp } =
    usePayroll();

  // Read once on the client (the page shows a loader until payroll has loaded).
  const [now] = useState(() => new Date());
  const periodOptions = useMemo(() => recentPeriods(now), [now]);
  const runByPeriod = useMemo(() => new Map(runs.map((r) => [r.period, r] as const)), [runs]);
  /** The month in view. Defaults to the newest run, else the last month that has ended. */
  const [chosen, setChosen] = useState<string | null>(null);
  const period = chosen ?? runs[0]?.period ?? lastCompletedPeriod(now);
  const run = runByPeriod.get(period) ?? null;
  const ended = monthHasEnded(period);

  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detail, setDetail] = useState<ApiRunDetail | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  /** Bumped after a pay change so the "not on this run" list re-reads. */
  const [reloadKey, setReloadKey] = useState(0);

  const shown = detail?.period === period ? detail : null;
  const warnings = shown ? shown.lines.filter((l) => lineNotes(l).some((n) => n.tone === "warning")).length : 0;

  useAssistantPageContext({
    facts: [
      { label: "Pay runs", value: String(runs.length) },
      { label: "Month", value: periodLabel(period) },
      ...(run
        ? [
            { label: "Status", value: run.status === "final" ? "Final" : "Draft" },
            { label: "Net pay", value: formatCurrency(run.net, currency) },
            { label: "Gross pay", value: formatCurrency(run.gross, currency) },
            { label: "Deductions", value: formatCurrency(run.deductions, currency) },
          ]
        : [{ label: "Status", value: "Not drafted" }]),
    ],
  });

  async function handleDraft() {
    const p = period;
    // A real month only (WP-269); the picker offers only real months and the server checks too.
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) return;
    setBusy(true);
    try {
      const r = await draft(p);
      setChosen(r.period);
      toast.success(`${run ? "Redrafted" : "Drafted"} ${periodLabel(r.period)}`, {
        description: `Net ${formatCurrency(r.net, currency)}`,
      });
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 409
          ? `${periodLabel(p)} is finalized — a finalized run can't be redrafted.`
          : e instanceof ApiError
            ? e.message
            : "Couldn't draft the run.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setBusy(true);
    try {
      await finalize(period);
      toast.success(`Finalized ${periodLabel(period)}`, {
        description: "Each person on the run can now open their payslip.",
      });
      setConfirmOpen(false);
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

  const editPay = (target: PayTarget | null) => {
    setPayTarget(target);
    setPayOpen(true);
  };

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
        <PageHeader title="Payroll" description="Monthly pay runs." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const status = run ? (run.status === "final" ? "Finalized" : "Draft") : "Not drafted";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Pick a month, check each person's pay, then finalize."
        actions={<RefreshButton onRefresh={reload} refreshing={loading} />}
      />

      {/* The month, its status, its totals and the one next step. */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={period}
              onValueChange={(v) => setChosen(v as string)}
              items={Object.fromEntries(periodOptions.map((p) => [p, periodLabel(p)]))}
            >
              <SelectTrigger className="w-48" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => {
                  const r = runByPeriod.get(p);
                  return (
                    <SelectItem key={p} value={p}>
                      {periodLabel(p)}
                      {r?.status === "final" ? " · finalized" : r ? " · draft" : !monthHasEnded(p) ? " · in progress" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Badge
              className={cn(
                run?.status === "final"
                  ? "bg-success/12 text-success"
                  : run
                    ? "bg-warning/15 text-warning"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {status}
            </Badge>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {canManage ? (
                <Button variant="outline" onClick={() => editPay(null)}>
                  <Banknote className="size-4" /> Set pay
                </Button>
              ) : null}
              {canManage && run?.status !== "final" ? (
                <Button variant={run && ended ? "outline" : "default"} onClick={handleDraft} disabled={busy}>
                  <Plus className="size-4" /> {run ? "Redraft" : "Draft run"}
                </Button>
              ) : null}
              {canManage && run?.status === "draft" && ended ? (
                <Button onClick={() => setConfirmOpen(true)} disabled={busy}>
                  <CheckCircle2 className="size-4" /> Review &amp; finalize
                </Button>
              ) : null}
            </div>
          </div>

          {run ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure label="Net pay" value={formatCurrency(run.net, currency)} strong />
              <Figure label="Gross" value={formatCurrency(run.gross, currency)} />
              <Figure
                label="Deductions"
                value={formatCurrency(run.deductions, currency)}
                hint={run.gross > 0 ? `${Math.round((run.deductions / run.gross) * 100)}% of gross` : undefined}
              />
              <Figure
                label="People paid"
                value={shown ? String(shown.lines.length) : "…"}
                hint={
                  shown && (shown.not_on_run?.length ?? 0) > 0
                    ? `${shown.not_on_run!.length} not on this run`
                    : undefined
                }
              />
            </dl>
          ) : null}

          <p className="text-muted-foreground text-xs">
            {run?.status === "final"
              ? `${periodLabel(period)} is finalized — its payslips are issued and it can't be changed.`
              : !ended
                ? `${periodLabel(period)} hasn't ended — a draft is a preview: days still to come count as worked. It can be finalized once the month is over.`
                : run
                  ? "Redraft after changing anyone's pay, attendance or the deductions — a draft is recomputed from them."
                  : `Draft ${periodLabel(period)} to see each person's pay.`}
          </p>
        </CardContent>
      </Card>

      {run ? (
        <RunLinesCard
          run={run}
          currency={currency}
          canManage={canManage}
          reloadKey={reloadKey}
          onLoaded={setDetail}
          onEditPay={editPay}
          onRedraft={run.status === "draft" ? handleDraft : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Wallet}
              title={`No run for ${periodLabel(period)} yet`}
              description={
                canManage
                  ? "Drafting computes each person's pay from their salary or hourly rate, their attendance and tracked time, minus the deductions below."
                  : "Pay runs appear here once a payroll manager drafts them."
              }
              action={
                canManage ? (
                  <Button onClick={handleDraft} disabled={busy}>
                    <Plus className="size-4" /> Draft {periodLabel(period)}
                  </Button>
                ) : undefined
              }
              className="m-4 border-0"
            />
          </CardContent>
        </Card>
      )}

      {/* Deductions — editable for payroll:manage, read-only otherwise. */}
      <DeductionsCard
        deductions={deductions}
        loadError={deductionsError}
        onRetry={reload}
        canManage={canManage}
        onSave={saveDeductions}
      />

      {/* How the amounts are made. */}
      <div className="bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-4 py-2.5 text-xs">
        <strong className="text-foreground font-medium">Salaried</strong> people are paid their monthly
        salary for the days they were due to work, less days marked absent: salary × paid days ÷ the
        month&apos;s working days. Approved leave and holidays are paid; days before someone joined are
        not. <strong className="text-foreground font-medium">Hourly</strong> people are paid their rate
        for every hour their timer recorded, billable or not, approved corrections included. Each
        person&apos;s payslip is published to them when the run is finalized.
      </div>

      <SetPayDialog
        open={payOpen}
        target={payTarget}
        currency={currency}
        onOpenChange={setPayOpen}
        onSave={setComp}
        onSaved={(saved, name) => {
          setReloadKey((k) => k + 1);
          const canRedraft = run?.status === "draft" || (!run && canManage);
          toast.success(`Pay saved for ${name}`, {
            description: `${saved.pay_type === "hourly" ? "Hourly" : "Salaried"} at ${formatCurrency(saved.rate, currency)}${saved.pay_type === "hourly" ? "/h" : "/mo"}. ${canRedraft ? `Redraft ${periodLabel(period)} to apply it.` : ""}`,
            action: canRedraft
              ? { label: run ? "Redraft" : "Draft", onClick: () => void handleDraft() }
              : undefined,
          });
        }}
      />

      {/* Finalizing publishes payslips and can't be undone (WP-270). */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalize {periodLabel(period)}?</DialogTitle>
            <DialogDescription>
              {shown
                ? `${shown.lines.length} ${shown.lines.length === 1 ? "person" : "people"} will receive a payslip and be notified.`
                : "Everyone on this run will receive a payslip and be notified."}{" "}
              {warnings
                ? `${warnings} ${warnings === 1 ? "line has" : "lines have"} a note to check (absent days or no tracked time). `
                : ""}
              {shown?.not_on_run?.length
                ? `${shown.not_on_run.length} ${shown.not_on_run.length === 1 ? "person is" : "people are"} not on it. `
                : ""}
              A finalized run can&apos;t be changed afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} disabled={busy}>
              Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-display text-2xl font-semibold" : "text-lg font-medium")}>
        {value}
      </dd>
      {hint ? <dd className="text-muted-foreground text-xs">{hint}</dd> : null}
    </div>
  );
}
