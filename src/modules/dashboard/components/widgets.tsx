"use client";

import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  Camera,
  ArrowUpRight,
  Trophy,
  BellRing,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkline } from "@/components/shared/sparkline";
import { initials } from "@/lib/format";
import type { Performer } from "@/modules/dashboard/lib/dashboard-data";

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

export function TopEmployeesWidget({ people }: { people: Performer[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top performers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {people.length === 0 ? (
          // Scores are the desktop agent's deterministic productivity score — empty until an agent
          // reports. State that rather than seeding a leaderboard.
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Trophy className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No scores yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              The day&apos;s highest-scoring people rank here once the desktop agent&apos;s activity
              data feeds the scorer.
            </p>
          </div>
        ) : (
          people.map((u, i) => (
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
          ))
        )}
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
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Camera className="size-4" />
          </span>
          Screenshots captured
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-display text-3xl font-semibold tabular-nums">
          {count.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          {count === 0
            ? "none captured — the desktop agent isn't reporting yet"
            : "captured over the selected range"}
        </p>
        <Sparkline data={trend} area showDot={false} width={220} height={48} className="w-full" />
        <ViewAllLink href="/insights/screenshots" label="Open Screenshot Center" />
      </CardContent>
    </Card>
  );
}

/* --------------------- Alerts & Deadlines (honest) -------------------- */

/**
 * Alerts come from the desktop agent's anomaly scorer and deadlines from a project-deadline feed —
 * neither has a wired endpoint yet, so this states what will appear rather than seeding fake alerts.
 */
export function AlertsDeadlinesWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerts &amp; deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-muted">
            <BellRing className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">Nothing needs attention</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Anomaly alerts (overtime, idle stretches, burnout risk) surface here once the desktop
            agent reports and the scorer flags them. No alerts are fabricated.
          </p>
          <ViewAllLink href="/insights/anomalies" label="Open anomalies" />
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Upcoming Tasks (honest) --------------------------- */

/**
 * An org-wide "upcoming tasks" feed has no endpoint (the backend has per-user `/v1/me/tasks` only), so
 * this points to the canonical task views instead of inventing a schedule.
 */
export function UpcomingTasksWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-md bg-muted">
            <CalendarClock className="size-5 text-muted-foreground" />
          </span>
          <p className="text-sm font-medium">No org-wide task feed</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Deadlines live on each project board. Open Projects to see what&apos;s due — no schedule is
            fabricated here.
          </p>
          <ViewAllLink href="/projects" label="View projects" />
        </div>
      </CardContent>
    </Card>
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
  const pct = seatsTotal > 0 ? Math.round((seatsUsed / seatsTotal) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <CreditCard className="size-4" />
          </span>
          Billing overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Current plan</p>
          <p className="font-display text-xl font-semibold capitalize">
            {plan}
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
        <ViewAllLink href="/billing" label="Manage billing" />
      </CardContent>
    </Card>
  );
}
