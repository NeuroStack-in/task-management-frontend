"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import {
  AlertCircle,
  Check,
  Clock,
  CreditCard,
  Download,
  type LucideIcon,
} from "lucide-react";
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

/** Plan/payment edits ship in Phase 2 — flag them honestly instead of faking. */
function Phase2Chip() {
  return (
    <span
      className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      title="Available in Phase 2"
    >
      Phase 2
    </span>
  );
}

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
  const [cancelOpen, setCancelOpen] = useState(false);

  const plan = PLAN_TIERS.find((t) => t.id === CURRENT_PLAN.tierId);
  const monthly = CURRENT_PLAN.seatsUsed * CURRENT_PLAN.pricePerSeat;
  const seatPct = Math.round(
    (CURRENT_PLAN.seatsUsed / CURRENT_PLAN.seatsTotal) * 100,
  );

  const confirmCancel = () => {
    setCancelOpen(false);
    toast.success("Cancellation requested", {
      description: `Your plan stays active until ${CURRENT_PLAN.renewsOn}.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Plan, usage, payment method, and invoice history."
      />

      <Card className="gap-0 p-0">
        <CardContent className="divide-y p-0">
          {/* ── Plan ── */}
          <section className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-heading text-base font-semibold">
                  {plan?.name} plan
                </p>
                <p className="text-sm text-muted-foreground">{plan?.blurb}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Renews on {CURRENT_PLAN.renewsOn} · {CURRENT_PLAN.billingCycle} ·{" "}
                  {formatCurrency(CURRENT_PLAN.pricePerSeat)}/seat
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <p className="font-display text-xl font-semibold tabular-nums">
                {formatCurrency(monthly)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <Phase2Chip />
            </div>
          </section>

          {/* ── Usage ── */}
          <section className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Usage</p>
              <span className="text-xs tabular-nums text-muted-foreground">
                {CURRENT_PLAN.seatsUsed} / {CURRENT_PLAN.seatsTotal} seats ({seatPct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  seatPct >= 85 ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {USAGE_METERS.map((m) => {
                const pct = Math.round((m.used / m.total) * 100);
                return (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{m.label}</span>
                      <span className="tabular-nums">
                        {m.used.toLocaleString()} / {m.total.toLocaleString()} {m.unit}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          pct >= 85 ? "bg-warning" : "bg-primary/60",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {pct}% used
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Payment ── */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Payment method</p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="flex h-7 w-10 items-center justify-center rounded-md border bg-muted text-[0.6rem] font-semibold tracking-wide">
                  {PAYMENT_METHOD.brand}
                </span>
                <span className="font-mono tracking-wider">•••• {PAYMENT_METHOD.last4}</span>
                <span className="text-muted-foreground">
                  expires {PAYMENT_METHOD.expires}
                </span>
              </div>
              <Phase2Chip />
            </div>
          </section>

          {/* ── Invoices ── */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Invoice history</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INVOICES.map((inv) => {
                  const meta = INVOICE_STATUS_META[inv.status];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {inv.number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{inv.date}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(inv.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "gap-1 rounded-sm text-[11px] font-medium",
                            meta.cls,
                          )}
                        >
                          <meta.Icon className="size-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Download ${inv.number}`}
                          onClick={() => downloadInvoice(inv)}
                        >
                          <Download className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>

          {/* ── Cancel plan ── */}
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
              onClick={() => setCancelOpen(true)}
            >
              Cancel plan
            </Button>
          </section>
        </CardContent>
      </Card>

      {/* Cancel confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel your {plan?.name} plan?</DialogTitle>
            <DialogDescription>
              Your plan stays active until {CURRENT_PLAN.renewsOn}. After that the
              workspace moves to the free tier and monitoring stops.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep plan
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmCancel}
            >
              Cancel plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
