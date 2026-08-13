"use client";

import { useEffect, useState } from "react";
import {
  Gauge,
  Users,
  Clock,
  Camera,
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
        {/* The score covers the whole trackable team, so state how much of it actually reported —
            otherwise a low number reads as "the org collapsed" when it means "one agent is on". */}
        {/* PRODUCTIVITY.md §3.2: the score is the mean over **those who reported**, and its
            coverage is always adjacent — a score without coverage is a misleading number.
            When nobody reported, there is no score: render the absence, never a confident 0%. */}
        <StatCard
          label="Productivity Score"
          value={
            data.productivityCoverage.scored === 0
              ? "—"
              : `${kpis.productivity.value}%`
          }
          icon={Gauge}
          hint={
            data.productivityCoverage.scored === 0
              ? `no agent reported · ${rangeLabel}`
              : `${data.productivityCoverage.scored} of ${data.productivityCoverage.team} reporting · ${rangeLabel}`
          }
          trend={kpis.productivity.trend}
          href="/insights/reports"
          featured
        />
        {range === "today" ? (
          <>
            {/* One "Working now" card folds in the old Working-now / Not-working / Running-timers
                trio — they were the same running-timer fact (working = running-timers) plus its
                complement. Value is working / team; the hint carries the idle count. Links straight
                to the attendance-log roster where you see *who*. */}
            <StatCard
              label="Working now"
              value={`${kpis.active.value} / ${kpis.active.value + kpis.inactive.value}`}
              icon={Users}
              hint={`${kpis.inactive.value} not tracking · today`}
              href={`/attendance#${ATTENDANCE_LOG_ANCHOR}`}
            />
            {/* Two genuinely distinct dimensions the trio never showed: total effort (active hours)
                and monitoring volume (screenshots) — both real, today-scoped, and drilling to their
                canonical pages. */}
            <StatCard
              label="Hours Tracked"
              value={`${kpis.hours.value.toLocaleString()}h`}
              icon={Clock}
              hint="active time today"
              href="/time-tracking"
            />
            <StatCard
              label="Screenshots"
              value={`${data.screenshotCount.toLocaleString()}${
                data.screenshotCountPartial && data.screenshotCount > 0 ? "+" : ""
              }`}
              icon={Camera}
              hint="captured today"
              href="/insights/screenshots"
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
