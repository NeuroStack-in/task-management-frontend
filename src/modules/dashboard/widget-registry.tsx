import type { ReactNode } from "react";
import type { WidgetType } from "@/stores/dashboard.store";
import { ProductivityChart } from "./components/productivity-chart";
import { ProductivityTrendChart } from "./components/productivity-trend-chart";
import { TeamComparisonChart } from "./components/team-comparison-chart";
import {
  ProductivityHeatmap,
  AttendanceDonut,
  ActiveInactiveRing,
  HeadcountStatus,
} from "./components/insight-widgets";
import {
  TopEmployeesWidget,
  LiveTimersWidget,
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
        rangeLabel={d.trendLabel}
      />
    ),
  },
  "org_activity.score_trend": {
    span: 1,
    render: (d) => (
      <ProductivityTrendChart
        data={d.productivityScoreTrend}
        rangeLabel={d.trendLabel}
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
  "org_attendance.live_timers": {
    span: 1,
    render: (d) => <LiveTimersWidget timers={d.liveTimers} />,
  },
  "org_activity.active_ring": {
    span: 1,
    render: (d) => (
      <ActiveInactiveRing
        active={d.activeCount}
        inactive={d.inactiveCount}
        title="Employment status"
        description="Share of directory accounts that are active rather than deactivated"
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
  "org_activity.top_performers": {
    span: 1,
    render: (d) => <TopEmployeesWidget people={d.topPerformers} />,
  },
  // Follows the dashboard's range control like every other widget — the narrative it fetches is the
  // one covering the selected period (day / ISO week / calendar month).
  "attention_list.ai_summary": {
    span: 1,
    render: (d) => (
      <OrgAiSummaryWidget
        range={d.range}
        rangeLabel={d.rangeLabel}
        days={d.days}
        department={d.team}
        departmentLabel={d.teamLabel}
      />
    ),
  },
  payroll_summary: { span: 1, render: (d) => <BillingWidget {...d.billing} /> },
  "attention_list.alerts": { span: 1, render: () => <AlertsDeadlinesWidget /> },
  "reports.upcoming_tasks": { span: 1, render: () => <UpcomingTasksWidget /> },
};
