"use client";

import { useState } from "react";
import { Users, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { PersonalTimeView } from "./personal-time-view";
import { TeamTimeView } from "./team-time-view";

type View = "team" | "personal";

/**
 * Role-aware Time Tracking (see Docs/RBAC.md):
 * - Personal tracker for people who log their own time (`time-tracking:self`), on the **real**
 *   backend (`/v1/me/timesheet`).
 * - Team timesheet oversight for management roles (`time-tracking:manage`). The backend serves only
 *   the caller's own timesheet, so this view degrades honestly (see `TeamTimeView`) instead of
 *   showing fabricated team aggregates.
 * Users with both (Owner/Admin) get a toggle and default to their own time.
 */
export function TimeTrackingView() {
  const { can } = usePermissions();
  const canManageTeam = can("time-tracking:manage");
  const canTrack = can("time-tracking:self");
  const showToggle = canManageTeam && canTrack;

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

      {view === "team" ? <TeamTimeView /> : <PersonalTimeView canExport={canTrack} />}
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
