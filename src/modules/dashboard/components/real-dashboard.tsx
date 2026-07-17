"use client";

/**
 * The org dashboard, on **real backend data**.
 *
 * A fixed KPI strip (headline counts) sits above a **customizable widget grid** — drag to reorder,
 * hide/show via Customize, layout persisted per browser (see `stores/dashboard.store`). Every widget
 * is live data or an honest "pending monitoring" placeholder; nothing is seeded.
 */
import {
  Users,
  UserCheck,
  FolderKanban,
  ListChecks,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CustomizableDashboard } from "./customizable-dashboard";
import type { DashboardSummary } from "../use-dashboard-summary";

export function RealDashboard({ summary }: { summary: DashboardSummary }) {
  const { employees, projects } = summary;

  return (
    <div className="space-y-4">
      {/* KPI strip — real counts, plus one honest pending card for the agent-gated score. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Employees"
          value={employees.total}
          icon={Users}
          hint={`${employees.departments} departments`}
          href="/employees"
          featured
        />
        <StatCard
          label="Active"
          value={employees.active}
          icon={UserCheck}
          hint={`${employees.inactive} inactive`}
          href="/employees"
        />
        <StatCard
          label="Projects"
          value={projects.total}
          icon={FolderKanban}
          hint={`${projects.active} active · ${projects.onHold} on hold`}
          href="/projects"
        />
        {projects.kpiCoverage ? (
          <StatCard
            label="Open tasks"
            value={projects.openTasks}
            icon={ListChecks}
            hint={projects.overdue > 0 ? `${projects.overdue} overdue` : "none overdue"}
            href="/projects"
          />
        ) : (
          <StatCard
            label="Productivity"
            value="—"
            icon={Gauge}
            hint="pending activity monitoring"
            href="/insights/reports"
          />
        )}
      </div>

      <CustomizableDashboard summary={summary} />

      {projects.overdue > 0 ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 text-destructive" />
          {projects.overdue} task{projects.overdue === 1 ? "" : "s"} overdue across your projects.
        </p>
      ) : null}
    </div>
  );
}
