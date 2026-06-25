"use client";

import { jsPDF } from "jspdf";
import {
  Check,
  CreditCard,
  Download,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import {
  CURRENT_PLAN,
  INVOICES,
  PAYMENT_METHOD,
  PLAN_TIERS,
  SPEND_TREND,
  USAGE_METERS,
  formatCurrency,
  type Invoice,
} from "@/lib/mock-billing";
import { cn } from "@/lib/utils";

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

const INVOICE_BADGE: Record<Invoice["status"], string> = {
  paid: "bg-success/15 text-success",
  due: "bg-warning/15 text-warning",
  failed: "bg-destructive/12 text-destructive",
};

export function BillingView() {
  const { can } = usePermissions();
  const canManage = can("billing:manage");

  const monthly = CURRENT_PLAN.seatsUsed * CURRENT_PLAN.pricePerSeat;
  const seatPct = Math.round(
    (CURRENT_PLAN.seatsUsed / CURRENT_PLAN.seatsTotal) * 100,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan, usage, invoices, and payment method."
      />

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Monthly spend"
          value={formatCurrency(monthly)}
          icon={TrendingUp}
          hint="this cycle"
          trend={SPEND_TREND}
          featured
        />
        <StatCard
          label="Seats used"
          value={`${CURRENT_PLAN.seatsUsed} / ${CURRENT_PLAN.seatsTotal}`}
          icon={Users}
          hint={`${seatPct}% allocated`}
          trend={[78, 82, 85, 88, 90, 93, CURRENT_PLAN.seatsUsed]}
        />
        <StatCard
          label="Plan"
          value="Business"
          icon={Wallet}
          hint={`${formatCurrency(CURRENT_PLAN.pricePerSeat)}/seat`}
        />
        <StatCard
          label="Next invoice"
          value={CURRENT_PLAN.renewsOn.replace(", 2026", "")}
          icon={Receipt}
          hint={CURRENT_PLAN.billingCycle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Current plan */}
        <Card className="bg-feature text-feature-foreground shadow-none lg:col-span-2">
          <CardContent className="flex flex-col gap-5 px-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Badge className="border-0 bg-white/15 text-white">
                Current plan
              </Badge>
              <p className="font-display text-2xl font-semibold">
                Business — {formatCurrency(monthly)}
                <span className="text-base font-normal text-feature-foreground/75">
                  /mo
                </span>
              </p>
              <p className="text-sm text-feature-foreground/80">
                {CURRENT_PLAN.seatsUsed} seats ×{" "}
                {formatCurrency(CURRENT_PLAN.pricePerSeat)} · renews{" "}
                {CURRENT_PLAN.renewsOn}
              </p>
              <div className="pt-1">
                <div className="mb-1 flex justify-between text-xs text-feature-foreground/75">
                  <span>Seats</span>
                  <span className="tabular-nums">
                    {CURRENT_PLAN.seatsUsed} / {CURRENT_PLAN.seatsTotal}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/20 sm:w-64">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${seatPct}%` }}
                  />
                </div>
              </div>
            </div>
            <Button
              className="bg-white text-primary hover:bg-white/90"
              disabled={!canManage}
              onClick={() => toast.info("Subscription management is a later phase.")}
            >
              Manage subscription
            </Button>
          </CardContent>
        </Card>

        {/* Payment method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" /> Payment method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted p-4">
              <p className="font-mono text-sm tracking-widest">
                •••• •••• •••• {PAYMENT_METHOD.last4}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{PAYMENT_METHOD.brand}</span>
                <span>Exp {PAYMENT_METHOD.expires}</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={!canManage}
              onClick={() => toast.info("Updating cards is a later phase.")}
            >
              Update card
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage meters */}
      <Card>
        <CardHeader>
          <CardTitle>Usage this cycle</CardTitle>
          <CardDescription>Resources consumed against your plan limits.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {USAGE_METERS.map((m) => {
            const pct = Math.round((m.used / m.total) * 100);
            return (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <span className="text-xs font-medium tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct >= 85 ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {m.used.toLocaleString()} / {m.total.toLocaleString()} {m.unit}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_TIERS.map((tier) => {
            const current = tier.id === CURRENT_PLAN.tierId;
            return (
              <Card
                key={tier.id}
                className={cn(current && "ring-2 ring-primary")}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{tier.name}</CardTitle>
                    {current ? <Badge>Current</Badge> : null}
                  </div>
                  <CardDescription>{tier.blurb}</CardDescription>
                  <p className="pt-1 font-display text-2xl font-semibold">
                    {formatCurrency(tier.pricePerSeat)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /seat/mo
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={current ? "outline" : "default"}
                    className="w-full"
                    disabled={current || !canManage}
                    onClick={() =>
                      toast.info(`Switching to ${tier.name} is a later phase.`)
                    }
                  >
                    {current ? "Current plan" : `Switch to ${tier.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Download past invoices as PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INVOICES.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      {inv.number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.date}
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {formatCurrency(inv.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0", INVOICE_BADGE[inv.status])}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadInvoice(inv)}
                      >
                        <Download className="size-4" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
