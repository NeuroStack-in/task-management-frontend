"use client";

import { useState } from "react";
import { Check, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { PLAN_TIERS, type PlanTier } from "@/modules/billing/lib/plans";
import { changePlan } from "../services/billing.service";
import { useBilling } from "../use-billing";
import { cn } from "@/lib/utils";

export function BillingView() {
  const { can } = usePermissions();
  const canManage = can("billing:manage");
  const { overview, loading, error, reload } = useBilling();

  // The plan-change confirm flow: pick a tier → confirm → POST → re-fetch.
  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null);
  const [changing, setChanging] = useState(false);

  async function confirmChange() {
    if (!pendingTier) return;
    setChanging(true);
    try {
      await changePlan({ plan: pendingTier.id });
      toast.success(`You're on the ${pendingTier.name} plan.`, {
        description: "Feature entitlements update within a few moments.",
      });
      setPendingTier(null);
      // Re-fetch the overview so the new plan/seat cap renders. Entitlements aren't cached
      // anywhere global — every consumer (feature gates, settings) re-fetches on mount, and the
      // server reconciles them asynchronously from `billing.plan_changed` anyway.
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change the plan.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't change the plan. Try again.");
      }
    } finally {
      setChanging(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading billing…" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="Billing & Subscription" description="Manage your plan and seats." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Billing is unavailable."}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // The live plan may or may not map to a priced catalog tier (e.g. `free` has none).
  const tier = PLAN_TIERS.find((t) => t.id === overview.plan);
  const capped = overview.seat_cap > 0;
  const seatPct = capped ? Math.round((overview.seats_used / overview.seat_cap) * 100) : 0;
  // A real, per-seat estimate — only when both the seat cap and a catalog price exist. Never invent
  // an invoiced amount; the backend serves no billed total.
  const estMonthly =
    tier && tier.pricePerSeat > 0 && capped ? overview.seats_used * tier.pricePerSeat : null;

  // On a downgrade the server keeps `seats_used` as-is, so the org can land over the new cap —
  // warn before confirming.
  const overCap = pendingTier !== null && overview.seats_used > pendingTier.seatCap;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan, seats, payment method, and invoices."
      />

      {/* Plan + payment */}
      <Card>
        <CardContent className="grid gap-8 px-6 md:grid-cols-2">
          {/* Plan */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current plan</p>
                <p className="font-display text-2xl font-semibold capitalize">{overview.plan}</p>
              </div>
              {estMonthly !== null ? (
                <p className="text-right">
                  <span className="font-display text-2xl font-semibold tabular-nums">
                    {formatCurrency(estMonthly)}
                  </span>
                  <span className="text-sm text-muted-foreground"> /mo est.</span>
                </p>
              ) : (
                <Badge variant="secondary" className="capitalize">
                  {overview.status}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {capped
                    ? `${overview.seats_used} of ${overview.seat_cap} seats`
                    : `${overview.seats_used} seats in use`}
                </span>
                {capped ? <span>{seatPct}%</span> : null}
              </div>
              {capped ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${seatPct}%` }} />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No seat cap on this plan.</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground capitalize">
              {overview.cadence} · status: {overview.status}
            </p>

            <Button
              variant="outline"
              size="sm"
              disabled={!canManage}
              onClick={() =>
                document.getElementById("billing-plans")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Manage subscription
            </Button>
          </div>

          {/* Payment — no endpoint yet (payments are unbuilt). Honest, not a fake card. */}
          <div className="space-y-4 md:border-l md:pl-8">
            <p className="text-sm text-muted-foreground">Payment method</p>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">No payment method on file</p>
                <p className="text-xs text-muted-foreground">
                  Payments aren&apos;t enabled for this environment yet.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage — the one real meter is seats. */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Usage this cycle</h2>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>Seats</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {capped
                ? `${overview.seats_used} / ${overview.seat_cap}`
                : `${overview.seats_used} in use`}
            </span>
          </div>
          {capped ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", seatPct >= 85 ? "bg-warning" : "bg-primary")}
                style={{ width: `${seatPct}%` }}
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Plans */}
      <section id="billing-plans" className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Plans</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_TIERS.map((t) => {
            const current = t.id === overview.plan;
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-2xl border p-4",
                  current ? "border-primary bg-primary/[0.03]" : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{t.name}</p>
                  {current ? (
                    <Badge variant="secondary" className="text-[11px]">
                      Current
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {formatCurrency(t.pricePerSeat)}
                  <span className="text-xs font-normal text-muted-foreground"> /seat/mo</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="size-3 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!current ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 -ml-2"
                    disabled={!canManage}
                    onClick={() => setPendingTier(t)}
                  >
                    Switch
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Invoices — no endpoint yet (invoicing is an unbuilt seam). */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Invoices</h2>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-10 text-center">
          <FileText className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="text-xs text-muted-foreground">
            Invoicing isn&apos;t enabled for this environment. Past invoices will appear here.
          </p>
        </div>
      </section>

      {/* Confirm plan change — no payment step: the change applies immediately (no provider). */}
      <Dialog
        open={pendingTier !== null}
        onOpenChange={(open) => {
          if (!open && !changing) setPendingTier(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {pendingTier?.name}?</DialogTitle>
            <DialogDescription>
              Your organization moves from the{" "}
              <span className="capitalize">{overview.plan}</span> plan to{" "}
              {pendingTier?.name} ({pendingTier ? formatCurrency(pendingTier.pricePerSeat) : ""}
              /seat/mo, up to {pendingTier?.seatCap.toLocaleString()} seats). The change takes
              effect immediately and adjusts which features your plan allows.
            </DialogDescription>
          </DialogHeader>
          {overCap ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              You currently use {overview.seats_used} seats — more than this plan&apos;s cap of{" "}
              {pendingTier?.seatCap}. Reduce active members after switching.
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTier(null)} disabled={changing}>
              Cancel
            </Button>
            <Button onClick={confirmChange} disabled={changing}>
              {changing ? "Switching…" : `Switch to ${pendingTier?.name ?? ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
