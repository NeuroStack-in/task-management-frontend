"use client";

import { jsPDF } from "jspdf";
import { Check, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CURRENT_PLAN,
  INVOICES,
  PAYMENT_METHOD,
  PLAN_TIERS,
  USAGE_METERS,
  formatCurrency,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/mock-billing";
import { cn } from "@/lib/utils";

const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { cls: string; label: string }
> = {
  paid: { cls: "bg-success/12 text-success", label: "Paid" },
  due: { cls: "bg-warning/15 text-warning", label: "Due" },
  failed: { cls: "bg-destructive/12 text-destructive", label: "Failed" },
};

function downloadInvoice(inv: Invoice) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("WorkPulse", 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text("Invoice", 14, 27);
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(`Invoice: ${inv.number}`, 14, 42);
  doc.text(`Date: ${inv.date}`, 14, 49);
  doc.text(`Billed to: ${PAYMENT_METHOD.name}`, 14, 56);
  doc.line(14, 64, 196, 64);
  doc.text("Business plan — monthly subscription", 14, 74);
  doc.text(formatCurrency(inv.amount), 170, 74);
  doc.line(14, 80, 196, 80);
  doc.setFontSize(13);
  doc.text("Total", 14, 90);
  doc.text(formatCurrency(inv.amount), 170, 90);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Status: ${inv.status.toUpperCase()}`, 14, 100);
  doc.save(`${inv.number}.pdf`);
  toast.success("Invoice downloaded", { description: `${inv.number}.pdf` });
}

export function BillingView() {
  const monthly = CURRENT_PLAN.seatsUsed * CURRENT_PLAN.pricePerSeat;
  const seatPct = Math.round(
    (CURRENT_PLAN.seatsUsed / CURRENT_PLAN.seatsTotal) * 100,
  );

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
                <p className="font-display text-2xl font-semibold">Business</p>
              </div>
              <p className="text-right">
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {formatCurrency(monthly)}
                </span>
                <span className="text-sm text-muted-foreground"> /mo</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {CURRENT_PLAN.seatsUsed} of {CURRENT_PLAN.seatsTotal} seats
                </span>
                <span>{seatPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${seatPct}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Renews {CURRENT_PLAN.renewsOn} · {CURRENT_PLAN.billingCycle}
            </p>

            {/* Stub CTA: always disabled — subscription management is a later phase */}
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Subscription management is available in a later phase."
            >
              Manage subscription
            </Button>
          </div>

          {/* Payment */}
          <div className="space-y-4 md:border-l md:pl-8">
            <p className="text-sm text-muted-foreground">Payment method</p>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-mono text-sm tracking-wider">
                  •••• {PAYMENT_METHOD.last4}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD.brand} · Exp {PAYMENT_METHOD.expires}
                </p>
              </div>
            </div>
            {/* Stub CTA: always disabled — card update is a later phase */}
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              disabled
              title="Updating payment method is available in a later phase."
            >
              Update card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Usage this cycle
        </h2>
        <div className="space-y-4">
          {USAGE_METERS.map((m) => {
            const pct = Math.round((m.used / m.total) * 100);
            return (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {m.used.toLocaleString()} / {m.total.toLocaleString()} {m.unit}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct >= 85 ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans — current tier is collapsed to a label; only upgrades/downgrades shown */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Plans</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_TIERS.filter((t) => t.id !== CURRENT_PLAN.tierId).map((tier) => (
            <div
              key={tier.id}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{tier.name}</p>
              </div>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                {formatCurrency(tier.pricePerSeat)}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  /seat/mo
                </span>
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Check className="size-3 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              {/* Stub CTA: always disabled — plan switching is a later phase */}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 -ml-2"
                disabled
                title={`Switching to ${tier.name} is available in a later phase.`}
              >
                Switch to {tier.name}
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Current plan: <span className="font-medium text-foreground">Business</span> · {formatCurrency(CURRENT_PLAN.pricePerSeat)}/seat/mo
        </p>
      </section>

      {/* Invoices */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Invoices</h2>
        <div className="divide-y rounded-lg border border-border">
          {INVOICES.map((inv) => {
            const meta = INVOICE_STATUS_META[inv.status] ?? {
              cls: "bg-muted text-muted-foreground",
              label: inv.status,
            };
            return (
              <div
                key={inv.id}
                className="flex items-center gap-4 px-4 py-3 text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  {inv.number}
                </span>
                <span className="flex-1 text-muted-foreground">{inv.date}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(inv.amount)}
                </span>
                <Badge className={cn("rounded-sm text-[11px] font-medium", meta.cls)}>
                  {meta.label}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label={`Download ${inv.number}`}
                  onClick={() => downloadInvoice(inv)}
                >
                  <Download className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
