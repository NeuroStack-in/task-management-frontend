"use client";

import { useState } from "react";
import {
  Users,
  UserRound,
  MonitorSmartphone,
  TriangleAlert,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { useDataScope } from "@/hooks/use-data-scope";
import { useIsFeatureOn } from "@/hooks/use-features";
import { cn } from "@/lib/utils";
import { useTeamTimesheet, type Period } from "../use-team-timesheet";
import { PersonalTimeView } from "./personal-time-view";
import { PayslipsLink } from "./payroll-widget";
import { TeamTimeView } from "./team-time-view";

type View = "team" | "personal";

/**
 * Role-aware Time Tracking (see Docs/RBAC.md):
 * - Personal tracker for people who log their own time (`time-tracking:self`), on the **real**
 *   backend (`/v1/me/timesheet`) — unchanged.
 * - Team timesheet oversight for management roles (`time-tracking:manage`), now fed by the **real**
 *   per-user reads assembled in `useTeamTimesheet` (`/v1/timesheet/user/{id}` + activity), replacing
 *   the old "not available yet" placeholder.
 * Someone holding both — a manager who also tracks their own time (Owner and Admin hold no
 * `time-tracking:self`, so not them) — gets a toggle and defaults to their own time. Team leads see
 * only their own department (`useDataScope`); a caller without `TimeReadTeam` gets an honest 403
 * state.
 */
export function TimeTrackingView() {
  const { can } = usePermissions();
  const { inScope } = useDataScope();
  const canManageTeam = can("time-tracking:manage");
  const canTrack = can("time-tracking:self");
  const showToggle = canManageTeam && canTrack;
  // Whether per-person activity scores can be read at all: the server's gate on the activity routes
  // (plan + toggle, owner exempt from the toggle) and the route's own `ActivityReadOrg`. Without
  // either, each person's read was a certain 403 (QA audit 2026-10-08, WP-196).
  const activityOn = useIsFeatureOn()("monitoring.activity") && can("activity:view");

  // Which week the team grid is showing: 0 = this week, -1 = last week, … Lives here because the
  // fan-out hook is called here; the grid's stepper drives it.
  const [weekOffset, setWeekOffset] = useState(0);
  // Week or month. Switching resets the offset to 0: "three back" means three *weeks* in one and
  // three *months* in the other, so carrying it across would silently jump the range by months.
  const [period, setPeriod] = useState<Period>("week");

  // The team view is only for someone who may oversee it. Anyone else — including a role that holds
  // only "View own timesheet" (`time-tracking:view`), which can read its own sheet but neither track
  // nor oversee — gets their own time: defaulting them to "team" ran a disabled hook into "No one in
  // view has tracked time" (QA audit 2026-10-08, WP-437).
  const [view, setView] = useState<View>(
    canManageTeam && !canTrack ? "team" : "personal",
  );

  // Only fetch the team roll-up while the team view is on screen — a pure employee never fans out,
  // and neither does a manager looking at "My time" (QA audit 2026-10-08, WP-434).
  const {
    teamRows,
    projectRows,
    dates,
    weekLabel,
    loaded,
    loading,
    error,
    forbidden,
    reload,
    truncated,
  } = useTeamTimesheet(canManageTeam && view === "team", weekOffset, period, activityOn);

  // Team leads only see their own team's timesheets; org roles see everyone.
  const scopedTeamRows = teamRows.filter((r) => inScope(r.id));

  const description =
    view === "team"
      ? "Review the team's tracked hours, billable time, and activity."
      : "Track your time, review today's timesheet, and monitor your weekly hours.";

  return (
    // No bottom padding of its own: the shell reserves the assistant button's room (XC-03).
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Time Tracking"
        description={description}
        actions={
          <div className="flex items-center gap-2">
            {/* Payslips sit at the foot of this page, under everything else — and /payroll, where
                people look for them, is an admin page. A way there from the top (UX audit
                2026-10-16, TIME-19). In-page, so it needs no route or permission of its own. */}
            {view === "personal" ? (
              <PayslipsLink className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Wallet className="size-4" /> My payslips
              </PayslipsLink>
            ) : null}
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
        ) : !loaded ? (
          // Only before the first read. After it, the grid stays mounted (dimmed) while the next
          // period loads, so its grouping, department filter and search survive the step.
          <Loader label="Assembling team timesheets…" className="min-h-64" />
        ) : !loading &&
          scopedTeamRows.length === 0 &&
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
          <>
            {truncated.length > 0 ? (
              // The server read stopped at its cap for these people, so their hours are a floor.
              <p className="text-muted-foreground text-xs" role="status">
                {truncated.length === 1
                  ? `${truncated[0]} has more sessions in this period than can be shown at once`
                  : `${truncated.length} people have more sessions in this period than can be shown at once`}
                {
                  " — their hours here are a minimum. Pick a shorter period to see everything."
                }
              </p>
            ) : null}
            <TeamTimeView
              rows={scopedTeamRows}
              projectRows={projectRows}
              dates={dates}
              weekLabel={weekLabel}
              weekOffset={weekOffset}
              period={period}
              onPeriodChange={(p) => {
                setPeriod(p);
                setWeekOffset(0);
              }}
              onWeekOffsetChange={setWeekOffset}
              updating={loading}
            />
          </>
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
      // Not colour alone: the selected view is announced (QA audit 2026-10-08, WP-439).
      aria-pressed={active}
      // Icon-only below `sm`, where the label pushed the page title out of the top bar (EMP-05);
      // the name stays for assistive tech.
      aria-label={label}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
