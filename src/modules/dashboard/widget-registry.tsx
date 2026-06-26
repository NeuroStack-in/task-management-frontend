import type { ReactNode } from "react";
import type { WidgetType } from "@/types";
import { ProductivityChart } from "./components/productivity-chart";
import { TeamComparisonChart } from "./components/team-comparison-chart";
import {
  ProductivityHeatmap,
  AttendanceDonut,
  HeadcountStatus,
} from "./components/insight-widgets";
import {
  TopEmployeesWidget,
  ScreenshotsWidget,
  DashboardInsight,
  BillingWidget,
} from "./components/widgets";
import type { DashboardData } from "./lib/dashboard-data";

export type { DashboardData } from "./lib/dashboard-data";

interface WidgetDef {
  /** Columns spanned on the xl (3-col) bento grid. */
  span: 1 | 2;
  render: (d: DashboardData) => ReactNode;
}

/**
 * Only widgets backed by real, derived data live here. Static placeholder
 * cards (the old ai-summary / alerts / deadlines / upcoming-tasks) were
 * removed. The registry is Partial so layouts persisted before that pruning
 * (which may still list removed types) resolve to no def and are skipped.
 */
export const WIDGET_REGISTRY: Partial<Record<WidgetType, WidgetDef>> = {
  "productivity-trends": {
    span: 2,
    render: (d) => (
      <ProductivityChart data={d.productivityTrend} rangeLabel={d.rangeLabel} />
    ),
  },
  heatmap: { span: 2, render: (d) => <ProductivityHeatmap data={d.heatmap} /> },
  "team-comparison": {
    span: 2,
    render: (d) => <TeamComparisonChart data={d.teamData} />,
  },
  attendance: {
    span: 1,
    render: (d) => (
      <AttendanceDonut
        counts={d.attendanceCounts}
        active={d.activeCount}
        inactive={d.inactiveCount}
      />
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
  "ai-summary": { span: 2, render: (d) => <DashboardInsight data={d} /> },
  billing: { span: 1, render: (d) => <BillingWidget {...d.billing} /> },
};
