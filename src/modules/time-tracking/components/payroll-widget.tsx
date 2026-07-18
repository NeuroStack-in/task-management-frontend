"use client";

import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Personal payroll for the current period.
 *
 * The mock computed a payslip from a hardcoded salary and attendance hours. There is **no payments
 * backend** — payroll is one of the genuinely-absent modules (no route serves pay, rates, or
 * deductions), so this shows an honest empty state rather than a fabricated payslip. It sits beside
 * the real weekly-hours chart on the personal Time Tracking view; when the pay module ships it drops
 * back in here behind its service.
 */
export function PayrollWidget() {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={Wallet}
          title="Payroll isn't connected yet"
          description="Your pay period, tracked hours, and net pay will appear here once the payroll module is live. Nothing is estimated in the meantime."
          className="border-0"
        />
      </CardContent>
    </Card>
  );
}
