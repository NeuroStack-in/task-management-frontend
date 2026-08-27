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
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { PLAN_TIERS, type PlanTier } from "@/modules/billing/lib/plans";
import { formatCurrency } from "@/lib/currency";
import { changePlan } from "@/modules/billing/services/billing.service";
import { useBilling } from "@/modules/billing/use-billing";
import { cn } from "@/lib/utils";

/**
 * Billing (Settings → Billing) — plan, seats, plan switching, payment and invoices.
 *
 * **This is the only billing page.** There used to be two: this panel, and a `BillingView` under
 * `/billing` that carried the plan switcher. `/billing` had been reduced to a `redirect()` back to
 * here, so the "Billing Center" button on this page pointed at a route that pointed back at this
 * page — a loop — and `BillingView` was orphaned, imported by nothing. The net effect was that
 * **no user could change their plan from the UI at all**, even though `POST /v1/billing/change-plan`
 * was live and working. The switcher now lives here and that component is gone.
 *
 * Payment and invoices stay honest "not enabled" placeholders — there is no provider and no
 * endpoint, and inventing UI for either would be a promise the product cannot keep.
 */
export function BillingSettings() {
  const { can } = usePermissions();
  const canManage = can("billing:manage");
  const { overview, loading, error, reload } = useBilling();

  // Pick a tier → confirm → POST → re-fetch.
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
      // Re-fetch so the new plan and seat cap render. The server reconciles entitlements
      // asynchronously from `billing.plan_changed`, so they may lag this by a moment.
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading billing…" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Your plan, payment method, and invoices." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Billing is unavailable."}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const tier = PLAN_TIERS.find((t) => t.id === overview.plan);
  const seats =
    overview.seat_cap > 0
      ? `${overview.seats_used} / ${overview.seat_cap} seats`
      : `${overview.seats_used} seats in use`;
  // Already over the cap on the CURRENT plan — worth saying before they pick a smaller one.
  const overCapNow = overview.seat_cap > 0 && overview.seats_used > overview.seat_cap;
  const overCapAfter = pendingTier !== null && overview.seats_used > pendingTier.seatCap;
  const currentIndex = PLAN_TIERS.findIndex((t) => t.id === overview.plan);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Manage your plan, payment method, and invoices." />

      <Card>
        <CardContent className="divide-y p-0">
          {/* Plan — real */}
          <section className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="bg-feature-tint text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-heading font-semibold capitalize">{overview.plan} plan</p>
                <p className="text-muted-foreground text-sm">
                  {tier?.blurb ?? "Your organization's current subscription."}
                </p>
                <p className="text-muted-foreground mt-1 text-xs capitalize">
                  {seats} · {overview.cadence} · status: {overview.status}
                </p>
                {overCapNow ? (
                  <p className="text-warning mt-1.5 text-xs">
                    You&apos;re using more seats than this plan allows. Upgrade, or deactivate
                    members to come back under the cap.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Plans — the switcher. Was orphaned in a component no route rendered. */}
          <section className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Plans</p>
              {!canManage ? (
                <p className="text-muted-foreground text-xs">
                  Only an owner or billing admin can change the plan.
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLAN_TIERS.map((t, i) => {
                const current = t.id === overview.plan;
                // "Upgrade" vs "Switch" reads off the tier's position, so the button says what it
                // actually does. It used to say "Switch" for all three, which is why nobody could
                // find an upgrade button.
                const label = i > currentIndex ? "Upgrade" : "Switch";
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex flex-col rounded-2xl border p-4",
                      current ? "border-primary bg-primary/[0.03]" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      {current ? (
                        <Badge variant="secondary" className="text-[11px]">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    <p className="font-display mt-1 text-xl font-semibold tabular-nums">
                      {formatCurrency(t.pricePerSeat)}
                      <span className="text-muted-foreground text-xs font-normal">
                        {" "}
                        /seat/mo
                      </span>
                    </p>
                    <ul className="text-muted-foreground mt-3 space-y-1.5 text-xs">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="text-success size-3 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!current ? (
                      <Button
                        size="sm"
                        variant={i > currentIndex ? "default" : "outline"}
                        className="mt-4 w-full"
                        disabled={!canManage}
                        onClick={() => setPendingTier(t)}
                      >
                        {label}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Payment — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Payment</p>
            <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
              <CreditCard className="size-4" />
              No payment method on file — payments aren&apos;t enabled yet.
            </div>
          </section>

          {/* Invoices — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Invoices</p>
            <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
              <FileText className="size-4" />
              No invoices yet. Invoicing isn&apos;t enabled for this environment.
            </div>
          </section>

          {/* Cancellation */}
          <section className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Cancel plan</p>
              <p className="text-muted-foreground text-xs">
                Your plan stays active until the end of the billing period.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              onClick={() =>
                toast.info("Self-serve cancellation isn't enabled yet.", {
                  description: "Contact support to change your plan.",
                })
              }
            >
              Cancel
            </Button>
          </section>
        </CardContent>
      </Card>

      <Dialog open={pendingTier !== null} onOpenChange={(o) => !o && setPendingTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {pendingTier?.name}?</DialogTitle>
            <DialogDescription>
              Your organization moves from the <span className="capitalize">{overview.plan}</span>{" "}
              plan to {pendingTier?.name} (
              {pendingTier ? formatCurrency(pendingTier.pricePerSeat) : ""}/seat/mo
              {pendingTier && pendingTier.seatCap > 0
                ? `, up to ${pendingTier.seatCap.toLocaleString()} seats`
                : ", unlimited seats"}
              ). The change takes effect immediately and adjusts which features your plan allows.
            </DialogDescription>
          </DialogHeader>
          {overCapAfter ? (
            <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-xs">
              You currently use {overview.seats_used} seats — more than this plan&apos;s cap of{" "}
              {pendingTier?.seatCap}. Reduce active members after switching.
            </p>
          ) : null}
          {/* Upgrading widens the plan's ceiling but does NOT switch new features on: the server
              recomputes `allowed` and leaves `enabled` alone, so someone still has to turn them on
              in Settings → Features. Saying so here prevents "I upgraded and nothing changed". */}
          {pendingTier && PLAN_TIERS.indexOf(pendingTier) > currentIndex ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
              New features are added to your plan but stay switched off. Turn them on in{" "}
              <span className="text-foreground font-medium">Settings → Features</span>.
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
