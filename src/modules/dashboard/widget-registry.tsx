import type { ReactNode } from "react";
import type { WidgetType } from "@/stores/dashboard.store";
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
  AlertsDeadlinesWidget,
  UpcomingTasksWidget,
  BillingWidget,
} from "./components/widgets";
// The AI summary is a real, self-fetching card (`GET /v1/me/insights/summary`) — reuse it instead of
// the preview's hardcoded paragraph, so nothing is fabricated.
import { OrgAiSummaryWidget } from "./components/real-widgets";
import type { DashboardData } from "./lib/dashboard-data";

export type { DashboardData } from "./lib/dashboard-data";

interface WidgetDef {
  /**
   * Columns spanned on the bento grid. All widgets are uniform (1) so the adaptive grid can always
   * tile without gaps; kept as a field in case a future widget needs a wider cell.
   */
  span: 1 | 2;
  render: (d: DashboardData) => ReactNode;
}

// Keys are the catalog-aligned widget types (`<catalog_id>` or `<catalog_id>.<variant>` —
// see `WidgetType` in `stores/dashboard.store.ts`, mirroring `wp-contracts::widgets`).
export const WIDGET_REGISTRY: Record<WidgetType, WidgetDef> = {
  "org_activity.trends": {
    span: 1,
    // A one-day "today" range draws a rolling 7-day trend (a single point is not a trend), so label
    // it accordingly; multi-day ranges show their own window.
    render: (d) => (
      <ProductivityChart
        data={d.productivityTrend}
        rangeLabel={d.range === "today" ? "last 7 days" : d.rangeLabel}
      />
    ),
  },
  "org_activity.heatmap": {
    span: 1,
    render: (d) => <ProductivityHeatmap data={d.heatmap} />,
  },
  team_activity: {
    span: 1,
    render: (d) => <TeamComparisonChart data={d.teamData} />,
  },
  org_attendance: {
    span: 1,
    render: (d) => <AttendanceDonut counts={d.attendanceCounts} />,
  },
  "org_activity.active_ring": {
    span: 1,
    render: (d) => (
      <ActiveInactiveRing
        active={d.activeCount}
        inactive={d.inactiveCount}
        title="Employment status"
        caption="active"
        activeLabel="Active"
        inactiveLabel="Deactivated"
      />
    ),
  },
  "reports.headcount": {
    span: 1,
    render: (d) => <HeadcountStatus counts={d.statusCounts} />,
  },
  "org_activity.screenshots": {
    span: 1,
    render: (d) => (
      <ScreenshotsWidget
        count={d.screenshotCount}
        trend={d.screenshotsTrend}
        partial={d.screenshotCountPartial}
      />
    ),
  },
  "org_activity.top_performers": {
    span: 1,
    render: (d) => <TopEmployeesWidget people={d.topPerformers} />,
  },
  // Follows the dashboard's range control like every other widget — the narrative it fetches is the
  // one covering the selected period (day / ISO week / calendar month).
  "attention_list.ai_summary": {
    span: 1,
    render: (d) => <OrgAiSummaryWidget range={d.range} rangeLabel={d.rangeLabel} />,
  },
  payroll_summary: { span: 1, render: (d) => <BillingWidget {...d.billing} /> },
  "attention_list.alerts": { span: 1, render: () => <AlertsDeadlinesWidget /> },
  "reports.upcoming_tasks": { span: 1, render: () => <UpcomingTasksWidget /> },
};
