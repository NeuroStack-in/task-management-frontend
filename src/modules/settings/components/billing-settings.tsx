"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { PLAN_TIERS } from "@/lib/mock-billing";
import { useBilling } from "@/modules/billing/use-billing";
import { ChangePlanDialog } from "@/modules/billing/components/change-plan-dialog";

/**
 * Account-level billing summary (Settings → Billing) — a compact panel over the **live**
 * subscription: plan, seats, status. Payment and invoices are honest "not enabled" placeholders
 * (no endpoint yet). The full Billing Center (`/billing`) is the source of truth for plan details.
 */
export function BillingSettings() {
  const { can } = usePermissions();
  const canManage = can("billing:manage");
  const { overview, loading, error, reload, changePlan } = useBilling();
  const [confirming, setConfirming] = useState(false);

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
  const seats = overview.seat_cap > 0
    ? `${overview.seats_used} / ${overview.seat_cap} seats`
    : `${overview.seats_used} seats in use`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your plan, payment method, and invoices."
      />

      <Card>
        <CardContent className="divide-y p-0">
          {/* Plan — real */}
          <section className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-heading font-semibold capitalize">{overview.plan} plan</p>
                <p className="text-sm text-muted-foreground">
                  {tier?.blurb ?? "Your organization's current subscription."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {seats} · {overview.cadence} · status: {overview.status}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              render={<Link href="/billing" />}
              nativeButton={false}
            >
              Billing Center
            </Button>
          </section>

          {/* Payment — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Payment</p>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <CreditCard className="size-4" />
              No payment method on file — payments aren&apos;t enabled yet.
            </div>
          </section>

          {/* Invoices — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Invoices</p>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <FileText className="size-4" />
              No invoices yet. Invoicing isn&apos;t enabled for this environment.
            </div>
          </section>

          {/* Downgrade — the backend has no cancellation/period-end concept; the only supported
              wind-down is switching to the `free` plan, which applies immediately. */}
          {canManage && overview.plan !== "free" ? (
            <section className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Downgrade to Free</p>
                <p className="text-xs text-muted-foreground">
                  Applies immediately and lowers your seat cap. There&apos;s no end-of-period
                  cancellation in this environment.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                Downgrade
              </Button>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <ChangePlanDialog
        open={confirming}
        onOpenChange={setConfirming}
        overview={overview}
        targetPlan={confirming ? "free" : null}
        onConfirm={changePlan}
      />
    </div>
  );
}
