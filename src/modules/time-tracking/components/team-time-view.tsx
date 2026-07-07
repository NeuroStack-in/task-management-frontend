"use client";

import { Clock, BadgeDollarSign, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TimesheetGrid } from "./timesheet-grid";
import type {
  DailyHours,
  ProjectTimesheet,
  TeamMemberTime,
} from "@/lib/mock-time";

export function TeamTimeView({
  rows,
  projectRows,
  weekly,
}: {
  rows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  weekly: DailyHours[];
}) {
  const teamHours = weekly.reduce((s, d) => s + d.hours, 0);
  const teamBillable = weekly.reduce((s, d) => s + d.billable, 0);
  const billablePct = Math.round((teamBillable / (teamHours || 1)) * 100);
  const avgActivity = Math.round(
    rows.reduce((s, r) => s + r.activity, 0) / (rows.length || 1),
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Team hours"
          value={`${teamHours.toLocaleString()}h`}
          icon={Clock}
          hint="this week"
          trend={weekly.map((d) => d.hours)}
          featured
        />
        <StatCard
          label="Billable"
          value={`${billablePct}%`}
          icon={BadgeDollarSign}
          delta={2}
        />
        <StatCard
          label="Avg activity"
          value={`${avgActivity}%`}
          icon={Activity}
          delta={3}
        />
      </div>

      <TimesheetGrid personRows={rows} projectRows={projectRows} />
    </div>
  );
}
