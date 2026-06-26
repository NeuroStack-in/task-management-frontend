"use client";

import Link from "next/link";
import { CreditCard, Camera, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkline } from "@/components/shared/sparkline";
import { AiInsight } from "@/components/shared/ai-insight";
import { initials } from "@/lib/format";
import type { User } from "@/types/user";
import type { DashboardData } from "../lib/dashboard-data";

/** Subtle footer link that routes a widget to its canonical page. */
function ViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

/* ----------------------------- Top Employees ----------------------------- */

export function TopEmployeesWidget({ people }: { people: User[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Employees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.map((u, i) => (
          <div key={u.id} className="flex items-center gap-3">
            <span className="w-4 text-xs font-medium text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <Avatar className="size-9">
              <AvatarImage src={u.avatarUrl} alt={u.name} />
              <AvatarFallback className="text-xs">
                {initials(u.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {u.department}
              </p>
            </div>
            <span className="font-mono text-sm font-medium text-primary tabular-nums">
              {u.productivityScore}%
            </span>
          </div>
        ))}
        <ViewAllLink href="/employees" label="All employees" />
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Screenshots ---------------------------- */

export function ScreenshotsWidget({
  count,
  trend,
}: {
  count: number;
  trend: number[];
}) {
  return (
    <Card className="justify-between">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-feature-tint text-primary">
            <Camera className="size-4" />
          </span>
          Screenshots Captured
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-display text-3xl font-semibold tabular-nums">
          {count.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">captured today</p>
        <Sparkline data={trend} area showDot={false} width={220} height={48} className="w-full" />
        <ViewAllLink href="/insights/screenshots" label="Open Screenshot Center" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ AI insight ------------------------------ */

/**
 * The single AI surface on the dashboard. Everything here is derived from the
 * live `DashboardData` (team scores, productivity delta, attendance) — no
 * scripted copy. It flags the biggest spread between departments so the gap is
 * actionable, and grounds the claim in the basis line.
 */
export function DashboardInsight({ data }: { data: DashboardData }) {
  const { teamData, kpis, attendanceCounts, rangeLabel } = data;
  const ranked = [...teamData].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const delta = kpis.productivity.deltaPct;
  const present = attendanceCounts.present + attendanceCounts.late;
  const total =
    present + attendanceCounts.leave + attendanceCounts.absent || 1;
  const attendancePct = Math.round((present / total) * 100);

  const trendDir = delta >= 0 ? "up" : "down";
  const title =
    top && bottom && top.team !== bottom.team
      ? `${bottom.team} trails ${top.team} by ${top.score - bottom.score} pts`
      : `Productivity ${trendDir} ${Math.abs(delta)}% ${rangeLabel}`;

  const points = [
    `Productivity ${kpis.productivity.value}% overall, ${delta >= 0 ? "+" : ""}${delta}% vs prior period`,
    top && bottom
      ? `${top.team} leads at ${top.score}%; ${bottom.team} lowest at ${bottom.score}%`
      : null,
    `Attendance holding at ${attendancePct}% clocked in`,
  ].filter(Boolean) as string[];

  return (
    <AiInsight
      title={title}
      detail={
        bottom
          ? `${bottom.team} is the widest gap to close — review its workload and blockers before it drags the org average.`
          : "Productivity is tracking close to plan across departments."
      }
      points={points}
      action={{ label: "Open reports", href: "/insights/reports" }}
      basis={`${teamData.length} departments · ${total} people, ${rangeLabel}`}
      className="h-full"
    />
  );
}

/* --------------------------- Billing Overview --------------------------- */

export function BillingWidget({
  plan,
  seatsUsed,
  seatsTotal,
}: {
  plan: string;
  seatsUsed: number;
  seatsTotal: number;
}) {
  const pct = Math.round((seatsUsed / seatsTotal) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-feature-tint text-primary">
            <CreditCard className="size-4" />
          </span>
          Billing Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="font-display text-xl font-semibold capitalize">
              {plan}
            </p>
          </div>
          <p className="font-mono text-sm text-muted-foreground tabular-nums">
            $2,400/mo
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Seats used</span>
            <span className="tabular-nums">
              {seatsUsed} / {seatsTotal}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Next invoice on the 1st · auto-pay on
        </p>
        <ViewAllLink href="/billing" label="Manage billing" />
      </CardContent>
    </Card>
  );
}
