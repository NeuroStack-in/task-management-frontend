"use client";

import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { OrgDashboard, type OrgKpis } from "./org-dashboard";
import { PersonalDashboard } from "./personal-dashboard";
import type { DashboardData } from "@/modules/dashboard/widget-registry";

/**
 * Picks the dashboard the current role should see: a personal, self-scoped view
 * for Employees, or the company-wide view for roles with org visibility.
 */
export function DashboardView({
  data,
  kpis,
}: {
  data: DashboardData;
  kpis: OrgKpis;
}) {
  const personal = useIsPersonalDashboard();
  return personal ? <PersonalDashboard /> : <OrgDashboard data={data} kpis={kpis} />;
}
