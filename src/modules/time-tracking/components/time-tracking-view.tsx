"use client";

import { useState } from "react";
import { Users, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useDataScope } from "@/hooks/use-data-scope";
import type {
  DailyHours,
  ProjectTimesheet,
  TeamMemberTime,
} from "@/lib/mock-time";
import { cn } from "@/lib/utils";
import { PersonalTimeView } from "./personal-time-view";
import { TeamTimeView } from "./team-time-view";

type View = "team" | "personal";

/**
 * Role-aware Time Tracking (see Docs/RBAC.md):
 * - Personal tracker for people who log their own time (`time-tracking:edit`).
 * - Team timesheets + approvals for oversight roles (`time-tracking:approve`),
 *   so Owners/Admins don't get a personal timer they'll never use.
 * Users with both (Owner/Admin) get a toggle and default to their own time.
 */
export function TimeTrackingView({
  teamRows,
  projectRows,
  teamWeekly,
}: {
  teamRows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  teamWeekly: DailyHours[];
}) {
  const { can } = usePermissions();
  const { inScope } = useDataScope();
  const canApprove = can("time-tracking:approve");
  const canTrack = can("time-tracking:edit");
  const showToggle = canApprove && canTrack;

  // Team leads only see their own team's timesheets; org roles see everyone.
  const scopedTeamRows = teamRows.filter((r) => inScope(r.id));

  const [view, setView] = useState<View>(
    canTrack ? "personal" : "team",
  );

  const description =
    view === "team"
      ? "Review the team's hours and approve timesheets."
      : "Track your time, review today's timesheet, and monitor your weekly hours.";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Time Tracking"
        description={description}
        actions={
          showToggle ? (
            <div className="flex rounded-full border bg-card p-0.5 shadow-soft">
              <ToggleButton
                active={view === "personal"}
                onClick={() => setView("personal")}
                icon={UserRound}
                label="My time"
              />
              <ToggleButton
                active={view === "team"}
                onClick={() => setView("team")}
                icon={Users}
                label="Team"
              />
            </div>
          ) : undefined
        }
      />

      {view === "team" ? (
        <TeamTimeView
          rows={scopedTeamRows}
          projectRows={projectRows}
          weekly={teamWeekly}
          canApprove={canApprove}
        />
      ) : (
        <PersonalTimeView canExport={canTrack} />
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}
