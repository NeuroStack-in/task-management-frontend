"use client";

import { Gauge, Users, UserMinus, Timer } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CustomizableDashboard } from "./customizable-dashboard";
import type { DashboardData } from "@/modules/dashboard/widget-registry";

export interface OrgKpis {
  avgProductivity: number;
  active: number;
  inactive: number;
  runningTimers: number;
}

/** Company-wide dashboard for roles with org visibility (Owner/Admin/Manager/HR). */
export function OrgDashboard({
  data,
  kpis,
}: {
  data: DashboardData;
  kpis: OrgKpis;
}) {
  return (
    <>
      {/* KPI strip (always shown) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Productivity Score"
          value={`${kpis.avgProductivity}%`}
          icon={Gauge}
          hint="this week"
          trend={[64, 66, 63, 70, 72, 69, 74]}
          featured
        />
        <StatCard
          label="Active Users"
          value={kpis.active}
          icon={Users}
          delta={4}
          trend={[58, 62, 60, 68, 64, 72, 78]}
        />
        <StatCard
          label="Inactive Users"
          value={kpis.inactive}
          icon={UserMinus}
          delta={-2}
          trend={[30, 28, 33, 27, 31, 26, 24]}
        />
        <StatCard
          label="Running Timers"
          value={kpis.runningTimers}
          icon={Timer}
          hint="live now"
          trend={[12, 18, 22, 19, 26, 24, 31]}
        />
      </div>

      <CustomizableDashboard data={data} />
    </>
  );
}
