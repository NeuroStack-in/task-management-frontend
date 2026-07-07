import type { ReactNode } from "react";
import type { WidgetType } from "@/types";
import { ProductivityChart } from "./components/productivity-chart";
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
  AlertsDeadlinesWidget,
  UpcomingTasksWidget,
  BillingWidget,
} from "./components/widgets";
import type { DashboardData } from "./lib/dashboard-data";

export type { DashboardData } from "./lib/dashboard-data";

interface WidgetDef {
  /**
   * Columns spanned on the bento grid. All widgets are uniform (1) so the
   * adaptive grid can always tile without gaps; charts render comfortably in a
   * single cell. Kept as a field in case a future widget needs a wider cell.
   */
  span: 1 | 2;
  render: (d: DashboardData) => ReactNode;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  "productivity-trends": {
    span: 1,
    render: (d) => (
      <ProductivityChart data={d.productivityTrend} rangeLabel={d.rangeLabel} />
    ),
  },
  heatmap: { span: 1, render: (d) => <ProductivityHeatmap data={d.heatmap} /> },
  "team-comparison": {
    span: 1,
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
  "alerts-deadlines": { span: 1, render: () => <AlertsDeadlinesWidget /> },
  "upcoming-tasks": { span: 1, render: () => <UpcomingTasksWidget /> },
};
