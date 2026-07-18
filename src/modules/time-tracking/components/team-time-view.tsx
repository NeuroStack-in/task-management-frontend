"use client";

import { MonitorSmartphone } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Team timesheet oversight.
 *
 * The mock showed team-wide hours, billable %, per-person daily grids and activity drill-downs. The
 * live backend serves **only the caller's own** timesheet (`/v1/me/timesheet`) — there is no
 * team/org read, and the per-person activity those grids showed is desktop-agent data that isn't
 * reporting yet. Rather than reproduce fabricated aggregates, this degrades honestly; it drops back
 * to a real grid once a management timesheet route (and agent activity) exists.
 *
 * The parent (`TimeTrackingView`) already renders the page header, so this is body-only.
 */
export function TeamTimeView() {
  return (
    <EmptyState
      icon={MonitorSmartphone}
      title="Team timesheets aren't available yet"
      description="The backend serves your own tracked time today — there's no team-wide timesheet or activity read. Once the management timesheet route and the desktop agent are live, the team grid and per-person activity appear here."
    />
  );
}
