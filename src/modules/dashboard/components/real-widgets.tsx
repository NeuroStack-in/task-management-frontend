"use client";

/**
 * The org dashboard's **real** widget cards — every figure here comes from a live endpoint
 * (employees, projects, billing). Kept in their own file (no imports from the registry or the
 * customizable shell) so the registry can import them without a cycle.
 *
 * The one honest exception is {@link MonitoringPendingCard}: the activity metrics it lists need the
 * desktop agent, which isn't reporting, so it states what's missing instead of seeding fake charts.
 */
import Link from "next/link";
import {
  FolderKanban,
  CreditCard,
  Building2,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "../use-dashboard-summary";

export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

/* ------------------------------ Projects overview ----------------------------- */

export function ProjectsOverviewCard({ p }: { p: DashboardSummary["projects"] }) {
  const rows: { label: string; value: string | number; tone?: string }[] = [
    { label: "Active", value: p.active },
    { label: "On hold", value: p.onHold },
    { label: "Completed", value: p.completed },
    { label: "Open tasks", value: p.kpiCoverage ? p.openTasks : "—" },
    {
      label: "Overdue",
      value: p.kpiCoverage ? p.overdue : "—",
      tone: p.overdue > 0 ? "text-destructive" : undefined,
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <FolderKanban className="size-4" />
          </span>
          Projects overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl font-semibold tabular-nums">{p.total}</p>
          <p className="text-xs text-muted-foreground">
            {p.avgCompletion === null
              ? "completion pending"
              : `${p.avgCompletion}% avg completion`}
          </p>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium tabular-nums ${r.tone ?? ""}`}>{r.value}</span>
            </li>
          ))}
        </ul>
        {p.kpiCoverage < p.total ? (
          <p className="text-[11px] text-muted-foreground">
            Task metrics cover {p.kpiCoverage}/{p.total} projects (KPIs still computing for the rest).
          </p>
        ) : null}
        <ViewAllLink href="/projects" label="All projects" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Department headcount ----------------------------- */

export function DepartmentHeadcountCard({
  departments,
}: {
  departments: DashboardSummary["employees"]["byDepartment"];
}) {
  const total = departments.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Building2 className="size-4" />
          </span>
          Headcount by department
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {departments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No departments yet.</p>
        ) : (
          departments.slice(0, 6).map((d) => {
            const pct = Math.round((d.count / total) * 100);
            return (
              <div key={d.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{d.name}</span>
                  <span className="font-medium tabular-nums">
                    {d.count} · {pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
        <ViewAllLink href="/employees" label="All employees" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Billing (real) ----------------------------- */

export function BillingCard({ billing }: { billing: DashboardSummary["billing"] }) {
  if (!billing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CreditCard className="size-4" />
            </span>
            Billing overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Billing isn&apos;t available for your account.
          </p>
          <ViewAllLink href="/billing" label="Manage billing" />
        </CardContent>
      </Card>
    );
  }
  // A plan with no seat cap set (e.g. free) reports `seat_cap: 0` — don't render "3 / 0" or a bogus
  // 0% bar; show the raw usage instead.
  const capped = billing.seatCap > 0;
  const pct = capped ? Math.round((billing.seatsUsed / billing.seatCap) * 100) : 0;
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
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="font-display text-xl font-semibold capitalize">{billing.plan}</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
            {billing.status}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Seats used</span>
            <span className="tabular-nums">
              {capped ? `${billing.seatsUsed} / ${billing.seatCap}` : `${billing.seatsUsed} in use`}
            </span>
          </div>
          {capped ? (
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No seat cap on this plan.</p>
          )}
        </div>
        <ViewAllLink href="/billing" label="Manage billing" />
      </CardContent>
    </Card>
  );
}

/* --------------------- Activity monitoring pending (honest) -------------------- */

export function MonitoringPendingCard() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Activity className="size-4" />
          </span>
          Activity monitoring
        </CardTitle>
      </CardHeader>
      <CardContent className="gap-3 text-sm text-muted-foreground">
        <p className="flex-1 leading-relaxed">
          Productivity scores, tracked hours, attendance rates, screenshots and per-team trends come
          from the desktop agent&apos;s activity data. The agent isn&apos;t reporting yet, so these
          are intentionally blank rather than estimated — they&apos;ll populate here once monitoring
          is live.
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {["Productivity", "Hours tracked", "Attendance rate", "Screenshots", "Heatmap", "Team comparison"].map(
            (m) => (
              <li key={m} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                {m}
              </li>
            ),
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
