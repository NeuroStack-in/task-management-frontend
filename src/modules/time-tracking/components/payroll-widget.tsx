"use client";

import { BadgeDollarSign, Clock, Wallet, type LucideIcon } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { payslipFor } from "@/lib/mock-payroll";
import { REFERENCE_MONTH, MONTH_NAMES } from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * The signed-in employee's payroll for the current month — how much they worked
 * and what the company pays for them (their salary). Reuses the pure payslip math
 * (attendance hours × rate). Sits beside the weekly hours chart on the personal
 * Time Tracking view (employee-only).
 */
export function PayrollWidget() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  const slip = payslipFor(user, REFERENCE_MONTH.year, REFERENCE_MONTH.month);
  const period = `${MONTH_NAMES[REFERENCE_MONTH.month]} ${REFERENCE_MONTH.year}`;
  const paid = slip.status === "paid";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeDollarSign className="size-4 text-primary" /> Payroll
        </CardTitle>
        <CardDescription>{period} · your pay period</CardDescription>
        <CardAction>
          <Badge
            className={cn(
              paid
                ? "bg-success/12 text-success"
                : "bg-warning/15 text-warning",
            )}
          >
            {paid ? "Paid" : "Pending"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        {/* Worked hours + the salary the company pays */}
        <div className="grid grid-cols-2 gap-3">
          <Stat
            icon={Clock}
            label="Hours worked"
            value={`${slip.hours}h`}
            sub="this month"
          />
          <Stat
            icon={Wallet}
            label="Net salary"
            value={usd(slip.net)}
            sub={`${usd(slip.hourlyRate)}/h`}
          />
        </div>

        {/* Monthly salary — what the company pays for the employee */}
        <div className="mt-auto">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Monthly salary
          </p>
          <dl className="space-y-1.5 text-sm">
            <PayRow label="Gross (company pays)" value={usd(slip.gross)} />
            <PayRow
              label="Tax & benefits"
              value={`− ${usd(slip.deductions)}`}
              muted
            />
            <PayRow label="Net pay" value={usd(slip.net)} strong />
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums leading-none">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function PayRow({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt
        className={cn(
          "text-muted-foreground",
          strong && "font-medium text-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          muted && "text-muted-foreground",
          strong && "font-semibold",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
