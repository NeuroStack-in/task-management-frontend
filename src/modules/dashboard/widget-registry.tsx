import type { ReactNode } from "react";
import type { WidgetType } from "@/types";
import type { User, UserStatus } from "@/types/user";
import type { AttendanceStatus } from "@/lib/mock-metrics";
import { TeamComparisonChart } from "./components/team-comparison-chart";
import {
  ProductivityHeatmap,
  AttendanceDonut,
  ActiveInactiveRing,
  HeadcountStatus,
} from "./components/insight-widgets";
import {
  TopEmployeesWidget,
  ScreenshotsWidget,
  AiSummaryWidget,
  AlertsWidget,
  DeadlineWidget,
  UpcomingTasksWidget,
  BillingWidget,
} from "./components/widgets";

/** All data the dashboard widgets need, computed once on the server. */
export interface DashboardData {
  teamData: { team: string; score: number }[];
  screenshotCount: number;
  screenshotsTrend: number[];
  topPerformers: User[];
  billing: { plan: string; seatsUsed: number; seatsTotal: number };
  heatmap: number[][];
  attendanceCounts: Record<AttendanceStatus, number>;
  statusCounts: Record<UserStatus, number>;
  activeCount: number;
  inactiveCount: number;
}

interface WidgetDef {
  /** Grid columns spanned on xl (1 or 2 of 3). */
  span: 1 | 2;
  render: (d: DashboardData) => ReactNode;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  heatmap: { span: 2, render: (d) => <ProductivityHeatmap data={d.heatmap} /> },
  "team-comparison": {
    span: 2,
    render: (d) => <TeamComparisonChart data={d.teamData} />,
  },
  attendance: {
    span: 1,
    render: (d) => <AttendanceDonut counts={d.attendanceCounts} />,
  },
  "active-inactive": {
    span: 1,
    render: (d) => (
      <ActiveInactiveRing active={d.activeCount} inactive={d.inactiveCount} />
    ),
  },
  headcount: {
    span: 1,
    render: (d) => <HeadcountStatus counts={d.statusCounts} />,
  },
  screenshots: {
    span: 1,
    render: (d) => (
      <ScreenshotsWidget count={d.screenshotCount} trend={d.screenshotsTrend} />
    ),
  },
  "top-employees": {
    span: 1,
    render: (d) => <TopEmployeesWidget people={d.topPerformers} />,
  },
  "ai-summary": { span: 1, render: () => <AiSummaryWidget /> },
  billing: { span: 1, render: (d) => <BillingWidget {...d.billing} /> },
  alerts: { span: 1, render: () => <AlertsWidget /> },
  deadlines: { span: 1, render: () => <DeadlineWidget /> },
  "upcoming-tasks": { span: 1, render: () => <UpcomingTasksWidget /> },
};
