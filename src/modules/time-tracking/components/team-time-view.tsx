"use client";

import { Clock, BadgeDollarSign, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { TimesheetGrid } from "./timesheet-grid";
import type { Period } from "../use-team-timesheet";
import type { DailyHours, ProjectTimesheet, TeamMemberTime } from "../types";

export function TeamTimeView({
  rows,
  projectRows,
  weekly,
  dates,
  weekLabel,
  weekOffset,
  onWeekOffsetChange,
  period,
  onPeriodChange,
}: {
  rows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  weekly: DailyHours[];
  dates: string[];
  weekLabel: string;
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const teamHours = weekly.reduce((s, d) => s + d.hours, 0);
  const teamBillable = weekly.reduce((s, d) => s + d.billable, 0);
  const billablePct = Math.round((teamBillable / (teamHours || 1)) * 100);
  const avgActivity = Math.round(
    rows.reduce((s, r) => s + r.activity, 0) / (rows.length || 1),
  );

  // Publish the team timesheet's week totals to the assistant.
  useAssistantPageContext({
    facts: [
      { label: "Week", value: weekLabel },
      { label: "Team hours", value: `${Math.round(teamHours).toLocaleString()}h` },
      { label: "Billable", value: `${billablePct}%` },
      { label: "Avg activity", value: `${avgActivity}%` },
      { label: "Team members", value: String(rows.length) },
    ],
  });

  return (
    <div className="space-y-5">
      {/* Manager-side counterpart of PersonalTimeView's `time:sessions` — same tour step, whichever
          branch of /time-tracking this role renders. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="time:sessions">
        {/* `trend` is the real Mon–Sun hours from `teamWeekly`; the mock `delta` seeds on the
            Billable/Activity cards were fabricated and are dropped — the values are real. */}
        <StatCard
          label="Team hours"
          value={`${Math.round(teamHours).toLocaleString()}h`}
          icon={Clock}
          // The card totals whichever week the grid is showing, so it must not claim "this week"
          // once you page back — that read as a live figure for a historical range.
          // Names the span it is actually totalling. It said "this week" regardless, so a month
          // view would have labelled a month's hours as a week's.
          hint={
            weekOffset === 0 ? (period === "month" ? "this month" : "this week") : weekLabel
          }
          trend={weekly.map((d) => d.hours)}
          featured
        />
        <StatCard label="Billable" value={`${billablePct}%`} icon={BadgeDollarSign} />
        <StatCard label="Avg activity" value={`${avgActivity}%`} icon={Activity} />
      </div>

      <TimesheetGrid
        personRows={rows}
        projectRows={projectRows}
        dates={dates}
        weekLabel={weekLabel}
        weekOffset={weekOffset}
        onWeekOffsetChange={onWeekOffsetChange}
        period={period}
        onPeriodChange={onPeriodChange}
      />
    </div>
  );
}
