"use client";

import { useState } from "react";
import {
  Users,
  UserRound,
  MonitorSmartphone,
  TriangleAlert,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useDataScope } from "@/hooks/use-data-scope";
import { cn } from "@/lib/utils";
import { useTeamTimesheet, type Period } from "../use-team-timesheet";
import { PersonalTimeView } from "./personal-time-view";
import { TeamTimeView } from "./team-time-view";

type View = "team" | "personal";

/**
 * Role-aware Time Tracking (see Docs/RBAC.md):
 * - Personal tracker for people who log their own time (`time-tracking:self`), on the **real**
 *   backend (`/v1/me/timesheet`) — unchanged.
 * - Team timesheet oversight for management roles (`time-tracking:manage`), now fed by the **real**
 *   per-user reads assembled in `useTeamTimesheet` (`/v1/timesheet/user/{id}` + activity), replacing
 *   the old "not available yet" placeholder.
 * Users with both (Owner/Admin) get a toggle and default to their own time. Team leads see only
 * their own department (`useDataScope`); a caller without `TimeReadTeam` gets an honest 403 state.
 */
export function TimeTrackingView() {
  const { can } = usePermissions();
  const { inScope } = useDataScope();
  const canManageTeam = can("time-tracking:manage");
  const canTrack = can("time-tracking:self");
  const showToggle = canManageTeam && canTrack;

  // Which week the team grid is showing: 0 = this week, -1 = last week, … Lives here because the
  // fan-out hook is called here; the grid's stepper drives it.
  const [weekOffset, setWeekOffset] = useState(0);
  // Week or month. Switching resets the offset to 0: "three back" means three *weeks* in one and
  // three *months* in the other, so carrying it across would silently jump the range by months.
  const [period, setPeriod] = useState<Period>("week");

  // Only fetch the team roll-up when the caller can actually see it — a pure employee never fans out.
  const {
    teamRows,
    projectRows,
    teamWeekly,
    dates,
    weekLabel,
    loading,
    error,
    forbidden,
    reload,
  } = useTeamTimesheet(canManageTeam, weekOffset, period);

  // Team leads only see their own team's timesheets; org roles see everyone.
  const scopedTeamRows = teamRows.filter((r) => inScope(r.id));

  const [view, setView] = useState<View>(canTrack ? "personal" : "team");

  const description =
    view === "team"
      ? "Review the team's tracked hours, billable time, and activity."
      : "Track your time, review today's timesheet, and monitor your weekly hours.";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Time Tracking"
        description={description}
        actions={
          view === "team" || showToggle ? (
            <div className="flex items-center gap-2">
              {/* Refetch the team roll-up in place. Personal view carries its own refresh inside
                  PersonalTimeView, whose hook owns that data. */}
              {view === "team" ? (
                <RefreshButton onRefresh={reload} refreshing={loading} />
              ) : null}
              {showToggle ? (
                <div className="bg-card shadow-soft flex rounded-full border p-0.5">
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
              ) : null}
            </div>
          ) : undefined
        }
      />

      {view === "team" ? (
        forbidden ? (
          <EmptyState
            icon={ShieldAlert}
            title="You don't have team time access"
            description="Reviewing other people's timesheets needs the team time-read permission. Ask an admin to grant it, or switch to your own time."
          />
        ) : error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Couldn't load team timesheets"
            description={error}
            action={
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            }
          />
        ) : loading ? (
          <Loader label="Assembling team timesheets…" className="min-h-64" />
        ) : scopedTeamRows.length === 0 &&
          projectRows.length === 0 &&
          weekOffset === 0 ? (
          // Only the *current* week short-circuits to a standalone empty state. On a past week the
          // grid must still render, because it carries the week stepper — swapping it out would
          // strand the viewer on a quiet week with no way back.
          <EmptyState
            icon={MonitorSmartphone}
            title="No tracked time this week"
            description="No one in view has tracked time for the current week yet. Entries appear here once the desktop agent syncs them."
          />
        ) : (
          <TeamTimeView
            rows={scopedTeamRows}
            projectRows={projectRows}
            weekly={teamWeekly}
            dates={dates}
            weekLabel={weekLabel}
            weekOffset={weekOffset}
            period={period}
            onPeriodChange={(p) => {
              setPeriod(p);
              setWeekOffset(0);
            }}
            onWeekOffsetChange={setWeekOffset}
          />
        )
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
