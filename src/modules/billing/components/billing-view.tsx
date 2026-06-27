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

  const nextInvoice =
    INVOICES.find((i) => i.status === "due") ?? INVOICES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Plan, seats, payment method, and invoice history."
      />

      {/* ── 2-col summary: left = plan + seats + usage, right = payment + next invoice + actions ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">

        {/* LEFT — Plan summary */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col gap-5 p-5 h-full">
            {/* Plan name + monthly price */}
            <div className="flex flex-wrap items-start justify-between gap-3">
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
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>Seats used</span>
                <span>{CURRENT_PLAN.seatsUsed} / {CURRENT_PLAN.seatsTotal} ({seatPct}%)</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", seatPct >= 85 ? "bg-warning" : "bg-primary")}
                  style={{ width: `${seatPct}%` }}
                />
              </div>
            </div>

            {/* Usage meters — 3-col grid fills the card width */}
            <div className="grid gap-4 sm:grid-cols-3">
              {USAGE_METERS.map((m) => {
                const pct = Math.round((m.used / m.total) * 100);
                return (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{m.label}</span>
                      <span className="tabular-nums">{m.used.toLocaleString()} / {m.total.toLocaleString()} {m.unit}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", pct >= 85 ? "bg-warning" : "bg-primary/60")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] tabular-nums text-muted-foreground">{pct}% used</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — Payment method + next invoice + plan action */}
        <Card className="flex flex-col">
          <CardContent className="flex flex-col gap-5 p-5 h-full">
            {/* Payment method */}
            <div>
              <p className="mb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment method</p>
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <CreditCard className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-mono tracking-wider">•••• {PAYMENT_METHOD.last4}</p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD.brand} · Exp {PAYMENT_METHOD.expires}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" disabled>
                  Update
                </Button>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Next invoice */}
            {nextInvoice && (
              <div>
                <p className="mb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Next invoice</p>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-xl font-semibold tabular-nums">
                    {formatCurrency(nextInvoice.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">due {CURRENT_PLAN.renewsOn}</span>
                </div>
              </div>
            )}

            <div className="border-t border-border" />

            {/* Plan picker */}
            <div>
              <p className="mb-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Change plan</p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="w-full justify-between gap-1.5" />
                  }
                >
                  Business — current
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {PLAN_TIERS.map((tier) => (
                    <DropdownMenuItem
                      key={tier.id}
                      disabled
                    >
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="flex items-center gap-2">
                          <Check className={cn("size-3.5 text-success", tier.id === CURRENT_PLAN.tierId ? "opacity-100" : "opacity-0")} />
                          <span className={tier.id === CURRENT_PLAN.tierId ? "font-medium" : ""}>
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
          </CardContent>
        </Card>
      </div>

      {/* ── Full-width invoice history table ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Invoice history</h2>
        <div className="w-full overflow-hidden rounded-lg border border-border">
          {/* Table header */}
          <div className="grid grid-cols-[minmax(7rem,auto)_1fr_minmax(7rem,auto)_minmax(6rem,auto)_2.5rem] items-center gap-4 border-b border-border bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span>Invoice</span>
            <span>Date</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
            <span />
          </div>
          {/* Rows */}
          <div className="divide-y divide-border">
            {INVOICES.map((inv) => {
              const meta = INVOICE_STATUS_META[inv.status] ?? {
                cls: "bg-muted text-muted-foreground",
                label: inv.status,
              };
              return (
                <div
                  key={inv.id}
                  className="grid grid-cols-[minmax(7rem,auto)_1fr_minmax(7rem,auto)_minmax(6rem,auto)_2.5rem] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="font-mono text-xs text-muted-foreground truncate">
                    {inv.number}
                  </span>
                  <span className="text-muted-foreground">{inv.date}</span>
                  <span className="text-right font-medium tabular-nums">
                    {formatCurrency(inv.amount)}
                  </span>
                  <span>
                    <Badge className={cn("gap-1 rounded-sm text-[11px] font-medium", meta.cls)}>
                      <meta.Icon className="size-3" />
                      {meta.label}
                    </Badge>
                  </span>
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
        </div>
      </section>
    </div>
  );
}
