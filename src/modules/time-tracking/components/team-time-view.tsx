"use client";

import { Clock, BadgeDollarSign, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TimesheetGrid } from "./timesheet-grid";
import type {
  DailyHours,
  ProjectTimesheet,
  TeamMemberTime,
} from "../types";

export function TeamTimeView({
  rows,
  projectRows,
  weekly,
  dates,
  weekLabel,
}: {
  rows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  weekly: DailyHours[];
  dates: string[];
  weekLabel: string;
}) {
  const teamHours = weekly.reduce((s, d) => s + d.hours, 0);
  const teamBillable = weekly.reduce((s, d) => s + d.billable, 0);
  const billablePct = Math.round((teamBillable / (teamHours || 1)) * 100);
  const avgActivity = Math.round(
    rows.reduce((s, r) => s + r.activity, 0) / (rows.length || 1),
  );

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
          hint="this week"
          trend={weekly.map((d) => d.hours)}
          featured
        />
        <StatCard
          label="Billable"
          value={`${billablePct}%`}
          icon={BadgeDollarSign}
        />
        <StatCard
          label="Avg activity"
          value={`${avgActivity}%`}
          icon={Activity}
        />
      </div>

      <TimesheetGrid
        personRows={rows}
        projectRows={projectRows}
        dates={dates}
        weekLabel={weekLabel}
      />
    </div>
  );
}
