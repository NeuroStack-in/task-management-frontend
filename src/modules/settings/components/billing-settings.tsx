"use client";

import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CURRENT_PLAN,
  INVOICES,
  PAYMENT_METHOD,
  PLAN_TIERS,
  formatCurrency,
} from "@/lib/mock-billing";

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-success/12 text-success",
  due: "bg-warning/15 text-warning",
  failed: "bg-destructive/12 text-destructive",
};

/**
 * Account-level billing summary (Settings → Billing) — a compact, Claude-style
 * panel: plan, payment method, recent invoices, and cancellation. The full
 * Billing Center (/billing) remains the source of truth for plan changes.
 */
export function BillingSettings() {
  const plan = PLAN_TIERS.find((t) => t.id === CURRENT_PLAN.tierId);
  const invoices = INVOICES.slice(0, 3);

  const soon = (what: string) =>
    toast.info(what, { description: "Manage this in Billing." });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your plan, payment method, and invoices."
      />

      <Card>
        <CardContent className="divide-y p-0">
          {/* Plan */}
          <section className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-heading font-semibold">{plan?.name} plan</p>
                <p className="text-sm text-muted-foreground">{plan?.blurb}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Renews on {CURRENT_PLAN.renewsOn} · {CURRENT_PLAN.billingCycle}{" "}
                  · ${CURRENT_PLAN.pricePerSeat}/seat
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => soon("Change plan")}
            >
              Change plan
            </Button>
          </section>

          {/* Payment */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Payment</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="flex h-7 w-10 items-center justify-center rounded-md border bg-muted text-[0.6rem] font-semibold tracking-wide">
                  {PAYMENT_METHOD.brand}
                </span>
                <span>•••• {PAYMENT_METHOD.last4}</span>
                <span className="text-muted-foreground">
                  expires {PAYMENT_METHOD.expires}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => soon("Update payment method")}
              >
                Update
              </Button>
            </div>
          </section>

          {/* Invoices */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Invoices</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(inv.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[inv.status]}>
                        {inv.status[0].toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => soon(`Invoice ${inv.number}`)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          {/* Cancellation */}
          <section className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Cancel plan</p>
              <p className="text-xs text-muted-foreground">
                Your plan stays active until the end of the billing period.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => soon("Cancel plan")}
            >
              Cancel
            </Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
