"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  Users,
  UserMinus,
  Timer,
  Clock,
  BadgeDollarSign,
  Activity,
} from "lucide-react";
import type { User } from "@/types/user";
import { StatCard } from "@/components/shared/stat-card";
import { GreetingHeader } from "./greeting-header";
import { DashboardControls } from "./dashboard-controls";
import { CustomizableDashboard } from "./customizable-dashboard";
import {
  buildDashboardData,
  teamsOf,
  type DashboardRange,
} from "../lib/dashboard-data";

export function DashboardView({ users }: { users: User[] }) {
  const [range, setRange] = useState<DashboardRange>("7d");
  const [team, setTeam] = useState("all");
  const [lastUpdated, setLastUpdated] = useState("");

  const teams = useMemo(() => teamsOf(users), [users]);
  const data = useMemo(
    () => buildDashboardData(users, { range, team }),
    [users, range, team],
  );

  // Stamp the refresh time on the client (and whenever the filters change) so we
  // never diverge from the server-rendered HTML.
  useEffect(() => {
    setLastUpdated(
      new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [range, team]);

  const { kpis, rangeLabel } = data;

  return (
    <div className="space-y-5 pt-1">
      <GreetingHeader />

      <DashboardControls
        range={range}
        onRangeChange={setRange}
        team={team}
        onTeamChange={setTeam}
        teams={teams}
        lastUpdated={lastUpdated}
      />

      {/* KPI strip — reactive to the active range/team. The "Today" range shows
          point-in-time counts; longer ranges show period aggregates instead, so
          every card stays meaningful for the selected window. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Productivity Score"
          value={`${kpis.productivity.value}%`}
          icon={Gauge}
          hint={rangeLabel}
          delta={kpis.productivity.deltaPct}
          trend={kpis.productivity.trend}
          href="/insights/reports"
          featured
        />
        {range === "today" ? (
          <>
            <StatCard
              label="Active Users"
              value={kpis.active.value}
              icon={Users}
              delta={kpis.active.deltaPct}
              trend={kpis.active.trend}
              href="/employees"
            />
            <StatCard
              label="Inactive Users"
              value={kpis.inactive.value}
              icon={UserMinus}
              delta={kpis.inactive.deltaPct}
              trend={kpis.inactive.trend}
              href="/employees"
            />
            <StatCard
              label="Running Timers"
              value={kpis.timers.value}
              icon={Timer}
              hint="live now"
              delta={kpis.timers.deltaPct}
              trend={kpis.timers.trend}
              href="/time-tracking"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Hours Tracked"
              value={`${kpis.hours.value.toLocaleString()}h`}
              icon={Clock}
              hint={rangeLabel}
              delta={kpis.hours.deltaPct}
              trend={kpis.hours.trend}
              href="/time-tracking"
            />
            <StatCard
              label="Billable"
              value={`${kpis.billable.value}%`}
              icon={BadgeDollarSign}
              delta={kpis.billable.deltaPct}
              trend={kpis.billable.trend}
              href="/insights/reports"
            />
            <StatCard
              label="Avg Activity"
              value={`${kpis.activity.value}%`}
              icon={Activity}
              hint={rangeLabel}
              delta={kpis.activity.deltaPct}
              trend={kpis.activity.trend}
              href="/insights/activity"
            />
          </>
        )}
      </div>

      <CustomizableDashboard data={data} />
    </div>
  );
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
