"use client";

import { useEffect, useState } from "react";
import {
  Gauge,
  Users,
  UserMinus,
  Timer,
  Clock,
  CalendarCheck,
  UserPlus,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { PageHeader } from "@/components/shared/page-header";
import { GreetingHeader } from "./greeting-header";
import { DashboardControls } from "./dashboard-controls";
import { CustomizableDashboard } from "./customizable-dashboard";
import { PersonalDashboard } from "./personal-dashboard";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { useDashboardData } from "../use-dashboard-data";
import type { DashboardRange } from "../lib/dashboard-data";

export function DashboardView() {
  // Self-scoped roles (Employee) get a personal dashboard, never org aggregates.
  const personal = useIsPersonalDashboard();

  if (personal) {
    return (
      <div className="space-y-4 pt-1">
        {/* `data-tour` marks the guided-walkthrough targets (modules/help/lib/tours.ts). Marked in
            BOTH branches deliberately: an Owner renders OrgDashboard and an Employee renders
            PersonalDashboard, so a marker on only one silently breaks the tour for half the roles. */}
        <div data-tour="dash:greeting">
          <GreetingHeader />
        </div>
        <PersonalDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <div data-tour="dash:greeting">
        <GreetingHeader />
      </div>
      <OrgDashboard />
    </div>
  );
}

/** The org (admin/owner/lead) view — the exact preview UI, on real backend data. */
function OrgDashboard() {
  // "Today" by default: the dashboard answers "what is happening right now", and a 7-day default
  // buried today's numbers in a week's average. The LLD does not fix a page-level default (§3 is
  // layout persistence; `date-range` there is per-widget config), so this is a product choice.
  const [range, setRange] = useState<DashboardRange>("today");
  const [team, setTeam] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const { data, teams, loading, error, reload } = useDashboardData({
    range,
    team,
    start,
    end,
  });

  // Stamp the refresh time on the client (and whenever the data/filters change) so the SSR HTML never
  // diverges from the client render.
  useEffect(() => {
    setLastUpdated(
      new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [range, team, start, end, data]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading dashboard…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" description="Your organization at a glance." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, rangeLabel } = data;

  return (
    <div className="space-y-4">
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

      {/* KPI strip — reactive to the active range/team. The "Today" range shows point-in-time counts;
          longer ranges show period aggregates. Deltas are omitted (no cheap real prior-window compare —
          a seeded % would be fabricated); sparklines render only where a real per-day series exists. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash:kpis">
        <StatCard
          label="Productivity Score"
          value={`${kpis.productivity.value}%`}
          icon={Gauge}
          hint={rangeLabel}
          trend={kpis.productivity.trend}
          href="/insights/reports"
          featured
        />
        {range === "today" ? (
          <>
            <StatCard
              label="Active employees"
              value={kpis.active.value}
              icon={Users}
              href="/employees"
            />
            <StatCard
              label="Inactive employees"
              value={kpis.inactive.value}
              icon={UserMinus}
              href="/employees"
            />
            <StatCard
              label="Running Timers"
              value={kpis.timers.value}
              icon={Timer}
              hint="online agents"
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
              href="/time-tracking"
            />
            <StatCard
              label="Attendance Rate"
              value={`${kpis.attendance.value}%`}
              icon={CalendarCheck}
              hint={rangeLabel}
              href="/attendance"
            />
            <StatCard
              label="New Hires"
              value={kpis.newHires.value}
              icon={UserPlus}
              hint="join date pending directory"
              href="/employees"
            />
          </>
        )}
      </div>

      <CustomizableDashboard data={data} />
    </div>
  );
}
