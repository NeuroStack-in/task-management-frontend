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
import { ATTENDANCE_LOG_ANCHOR } from "@/modules/attendance/components/attendance-log";
import { useDashboardData } from "../use-dashboard-data";
import type { DashboardRange } from "../lib/dashboard-data";

export function DashboardView() {
  // Self-scoped roles (Employee) get a personal dashboard, never org aggregates.
  const personal = useIsPersonalDashboard();

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
          <p className="text-muted-foreground text-sm">{error}</p>
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
            {/* Straight to the attendance log rather than the employee directory. Both numbers are
                about who is working *today*, and the roster answering that is below the fold on
                /attendance — the hash lands the reader on it instead of at the top of a page whose
                answer they then have to scroll for. */}
            <StatCard
              label="Active employees"
              value={kpis.active.value}
              icon={Users}
              href={`/attendance#${ATTENDANCE_LOG_ANCHOR}`}
            />
            <StatCard
              label="Inactive employees"
              value={kpis.inactive.value}
              icon={UserMinus}
              href={`/attendance#${ATTENDANCE_LOG_ANCHOR}`}
            />
            <StatCard
              label="Running Timers"
              value={kpis.timers.value}
              icon={Timer}
              // Was "online agents", which described the old fleet-presence source. It counts
              // running timers now, and the roster below the link is where you see whose.
              hint="tracking now"
              href={`/attendance#${ATTENDANCE_LOG_ANCHOR}`}
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
            {/* An unresolved rate is an absence, not a zero: statuses are stamped by the nightly
                close, so a window covering only today has nothing to measure. Showing 0% there put
                "nobody attended" beside a live productivity score for the same people. */}
            <StatCard
              label="Attendance Rate"
              value={
                data.attendanceResolvedDays === 0 ? "—" : `${kpis.attendance.value}%`
              }
              icon={CalendarCheck}
              hint={
                data.attendanceResolvedDays === 0 ? "awaiting nightly close" : rangeLabel
              }
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
