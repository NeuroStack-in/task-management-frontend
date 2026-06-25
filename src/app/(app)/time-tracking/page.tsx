import type { Metadata } from "next";
import { projects, users } from "@/lib/data";
import {
  buildProjectTimesheet,
  buildTeamTimesheet,
  TEAM_WEEKLY,
} from "@/lib/mock-time";
import { TimeTrackingView } from "@/modules/time-tracking/components/time-tracking-view";

export const metadata: Metadata = { title: "Time Tracking" };

export default function TimeTrackingPage() {
  return (
    <TimeTrackingView
      teamRows={buildTeamTimesheet(users)}
      projectRows={buildProjectTimesheet(projects)}
      teamWeekly={TEAM_WEEKLY}
    />
  );
}
