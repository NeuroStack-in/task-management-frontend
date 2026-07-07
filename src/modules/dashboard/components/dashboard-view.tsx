"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  Users,
  UserMinus,
  Timer,
  Clock,
  CalendarCheck,
  UserPlus,
} from "lucide-react";
import type { User } from "@/types/user";
import { StatCard } from "@/components/shared/stat-card";
import { GreetingHeader } from "./greeting-header";
import { DashboardControls } from "./dashboard-controls";
import { CustomizableDashboard } from "./customizable-dashboard";
import { PersonalDashboard } from "./personal-dashboard";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { useDataScope } from "@/hooks/use-data-scope";
import {
  buildDashboardData,
  teamsOf,
  type DashboardRange,
} from "../lib/dashboard-data";

export function DashboardView({ users }: { users: User[] }) {
  // Self-scoped roles (Employee) get a personal dashboard, never org aggregates.
  const personal = useIsPersonalDashboard();
  // Team leads see aggregates for their own team only; org roles see everyone.
  const { ids: scopeIds } = useDataScope();
  const scopedUsers = useMemo(
    () => users.filter((u) => scopeIds === null || scopeIds.has(u.id)),
    [users, scopeIds],
  );

  const [range, setRange] = useState<DashboardRange>("7d");
  const [team, setTeam] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const teams = useMemo(() => teamsOf(scopedUsers), [scopedUsers]);
  const data = useMemo(
    () => buildDashboardData(scopedUsers, { range, team, start, end }),
    [scopedUsers, range, team, start, end],
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
  }, [range, team, start, end]);

  const { kpis, rangeLabel } = data;

  if (personal) {
    return (
      <div className="space-y-4 pt-1">
        <GreetingHeader />
        <PersonalDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <GreetingHeader />

      <DashboardControls
        range={range}
        onRangeChange={setRange}
        team={team}
        onTeamChange={setTeam}
        teams={teams}
        lastUpdated={lastUpdated}
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
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
              label="Attendance Rate"
              value={`${kpis.attendance.value}%`}
              icon={CalendarCheck}
              hint={rangeLabel}
              delta={kpis.attendance.deltaPct}
              trend={kpis.attendance.trend}
              href="/attendance"
            />
            <StatCard
              label="New Hires"
              value={kpis.newHires.value}
              icon={UserPlus}
              hint={rangeLabel}
              delta={kpis.newHires.deltaPct}
              trend={kpis.newHires.trend}
              href="/employees"
            />
          </>
        )}
      </div>

      <CustomizableDashboard data={data} />
    </div>
  );
}
