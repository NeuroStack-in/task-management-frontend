"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  Sparkles,
  CreditCard,
  Camera,
  CircleDot,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkline } from "@/components/shared/sparkline";
import { useAssistantStore } from "@/stores/assistant.store";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

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
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
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

/* ------------------------------ AI Summary ------------------------------ */

export function AiSummaryWidget() {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> AI Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3 text-sm leading-relaxed text-feature-foreground/90">
        {/* flex-1 so the text grows and vertically centers, filling the card. */}
        <p className="flex-1">
          Productivity rose 3% this week, led by Engineering and Product, while
          overall attendance held steady at 80% with on-time rates ticking up.
          Average activity climbed to 84% and idle time fell 6% versus last
          week. Two teams — Design and Backend — show early burnout signals from
          sustained overtime, so they&apos;re worth a closer look. Screenshot
          coverage and timesheet submissions are both healthy, and no anomalies
          breached critical thresholds.
        </p>
        <button
          type="button"
          onClick={() =>
            openAssistant(
              "Summarise this week's productivity and flag any burnout risks.",
            )
          }
          className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
        >
          Ask the assistant <ArrowUpRight className="size-3.5" />
        </button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Recent Alerts ---------------------------- */

const ALERTS = [
  { tone: "danger", title: "Low productivity", detail: "Backend team · −8% today" },
  { tone: "warning", title: "Missing screenshots", detail: "3 agents offline > 2h" },
  { tone: "warning", title: "Long inactivity", detail: "J. Cannan idle 47m" },
  { tone: "danger", title: "Burnout risk", detail: "Design · 2 people flagged" },
] as const;

export function AlertsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ALERTS.map((a) => (
          <div key={a.title} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                a.tone === "danger"
                  ? "bg-destructive/12 text-destructive"
                  : "bg-warning/15 text-warning",
              )}
            >
              <AlertTriangle className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
            </div>
          </div>
        ))}
        <ViewAllLink href="/insights/anomalies" label="View all alerts" />
      </CardContent>
    </Card>
  );
}

/* -------------------------- Deadline Warnings -------------------------- */

const DEADLINES = [
  { task: "Q3 productivity report", due: "Due in 2h", urgent: true },
  { task: "Onboard 3 new hires", due: "Due today", urgent: true },
  { task: "Client billing review", due: "Tomorrow", urgent: false },
  { task: "Security policy update", due: "In 3 days", urgent: false },
];

export function DeadlineWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deadline Warnings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DEADLINES.map((d) => (
          <div key={d.task} className="flex items-center gap-3">
            <CalendarClock
              className={cn(
                "size-4 shrink-0",
                d.urgent ? "text-destructive" : "text-muted-foreground",
              )}
            />
            <p className="min-w-0 flex-1 truncate text-sm">{d.task}</p>
            <span
              className={cn(
                "shrink-0 text-xs font-medium",
                d.urgent ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {d.due}
            </span>
          </div>
        ))}
        <ViewAllLink href="/projects" label="View all deadlines" />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Upcoming Tasks --------------------------- */

const TASKS = [
  { title: "Review design tokens", project: "WEB-12", time: "9:30" },
  { title: "Sync with Platform team", project: "PLT-4", time: "11:00" },
  { title: "Draft hiring plan", project: "HR-7", time: "14:00" },
  { title: "Approve timesheets", project: "OPS-2", time: "16:30" },
];

export function UpcomingTasksWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {TASKS.map((t) => (
          <div key={t.title} className="flex items-center gap-3">
            <CircleDot className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.project}</p>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {t.time}
            </span>
          </div>
        ))}
        <ViewAllLink href="/projects" label="View my tasks" />
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
  const pct = Math.round((seatsUsed / seatsTotal) * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
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
