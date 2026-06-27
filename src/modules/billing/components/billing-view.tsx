"use client";

import { jsPDF } from "jspdf";
import { AlertCircle, Check, ChevronDown, Clock, CreditCard, Download, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  { cls: string; label: string; Icon: LucideIcon }
> = {
  paid: { cls: "bg-success/12 text-success", label: "Paid", Icon: Check },
  due: { cls: "bg-warning/15 text-warning", label: "Due", Icon: Clock },
  failed: { cls: "bg-destructive/12 text-destructive", label: "Failed", Icon: AlertCircle },
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

  // Next invoice is the first "due" invoice, or the last paid one
  const nextInvoice =
    INVOICES.find((i) => i.status === "due") ?? INVOICES[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Plan, seats, payment method, and invoice history."
      />

      {/* ── Compact summary card ── */}
      <Card>
        <CardContent className="p-5">
          {/* Top row: plan name + price + primary action */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current plan</p>
              <p className="font-display text-2xl font-semibold">Business</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-semibold tabular-nums">
                {formatCurrency(monthly)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(CURRENT_PLAN.pricePerSeat)}/seat · renews {CURRENT_PLAN.renewsOn}
              </p>
            </div>
          </div>

          {/* Seats bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>Seats used</span>
              <span>{CURRENT_PLAN.seatsUsed} / {CURRENT_PLAN.seatsTotal} ({seatPct}%)</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", seatPct >= 85 ? "bg-warning" : "bg-primary")}
                style={{ width: `${seatPct}%` }}
              />
            </div>
          </div>

          {/* Usage meters */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {USAGE_METERS.map((m) => {
              const pct = Math.round((m.used / m.total) * 100);
              return (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{m.label}</span>
                    <span className="tabular-nums">{m.used.toLocaleString()} / {m.total.toLocaleString()} {m.unit}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", pct >= 85 ? "bg-warning" : "bg-primary/60")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Bottom row: payment + next invoice + actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Payment method */}
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CreditCard className="size-4" />
              </span>
              <div>
                <p className="text-sm font-mono tracking-wider">•••• {PAYMENT_METHOD.last4}</p>
                <p className="text-xs text-muted-foreground">
                  {PAYMENT_METHOD.brand} · Exp {PAYMENT_METHOD.expires}
                </p>
              </div>
            </div>

            {/* Next invoice */}
            {nextInvoice && (
              <div className="text-sm">
                <span className="text-muted-foreground">Next invoice: </span>
                <span className="font-medium tabular-nums">{formatCurrency(nextInvoice.amount)}</span>
                <span className="text-muted-foreground"> on {CURRENT_PLAN.renewsOn}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Stub CTA: always disabled — card update is a later phase */}
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="Updating payment method is available in a later phase."
              >
                Update card
              </Button>
              {/* Plan picker — stub, all actions disabled */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="gap-1.5" />
                  }
                >
                  Change plan
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {PLAN_TIERS.map((tier) => (
                    <DropdownMenuItem
                      key={tier.id}
                      disabled
                      title={`Switching to ${tier.name} is available in a later phase.`}
                    >
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-2">
                          {tier.id === CURRENT_PLAN.tierId && (
                            <Check className="size-3.5 text-success" />
                          )}
                          <span className={tier.id === CURRENT_PLAN.tierId ? "font-medium" : "pl-[22px]"}>
                            {tier.name}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(tier.pricePerSeat)}/seat
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Invoice history ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Invoice history</h2>
        <div className="divide-y rounded-lg border border-border">
          {INVOICES.map((inv) => {
            const meta = INVOICE_STATUS_META[inv.status] ?? {
              cls: "bg-muted text-muted-foreground",
              label: inv.status,
            };
            return (
              <div
                key={inv.id}
                className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <span className="font-mono text-xs text-muted-foreground w-28 shrink-0">
                  {inv.number}
                </span>
                <span className="flex-1 text-muted-foreground">{inv.date}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(inv.amount)}
                </span>
                <Badge className={cn("gap-1 rounded-sm text-[11px] font-medium", meta.cls)}>
                  <meta.Icon className="size-3" />
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
