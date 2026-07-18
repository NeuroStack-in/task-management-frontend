import type { ReactNode } from "react";
import {
  ActiveInactiveRing,
  HeadcountStatus,
} from "./components/insight-widgets";
import {
  ProjectsOverviewCard,
  DepartmentHeadcountCard,
  BillingCard,
  MonitoringPendingCard,
  AiDailySummaryCard,
  AttendanceTodayCard,
  ProductivityHeatmapPendingCard,
  TeamComparisonPendingCard,
  TopPerformersPendingCard,
  RecentAlertsPendingCard,
} from "./components/real-widgets";
import type { DashboardSummary } from "./use-dashboard-summary";

/** The org dashboard's real, customizable widgets. Every one is live data or an honest placeholder. */
export type RealWidgetType =
  | "ai-summary"
  | "attendance-today"
  | "projects-overview"
  | "active-inactive"
  | "department-headcount"
  | "billing"
  | "headcount-status"
  | "monitoring-pending"
  | "productivity-heatmap"
  | "team-comparison"
  | "top-performers"
  | "recent-alerts";

interface WidgetDef {
  title: string;
  render: (s: DashboardSummary) => ReactNode;
}

export const WIDGET_REGISTRY: Record<RealWidgetType, WidgetDef> = {
  // Real, self-fetching widgets — they ignore `s` and read their own endpoint.
  "ai-summary": {
    title: "AI daily summary",
    render: () => <AiDailySummaryCard />,
  },
  "attendance-today": {
    title: "Attendance",
    render: () => <AttendanceTodayCard />,
  },
  "projects-overview": {
    title: "Projects overview",
    render: (s) => <ProjectsOverviewCard p={s.projects} />,
  },
  "active-inactive": {
    title: "Active vs inactive",
    render: (s) => (
      <ActiveInactiveRing active={s.employees.active} inactive={s.employees.inactive} />
    ),
  },
  "department-headcount": {
    title: "Headcount by department",
    render: (s) => <DepartmentHeadcountCard departments={s.employees.byDepartment} />,
  },
  billing: {
    title: "Billing overview",
    render: (s) => <BillingCard billing={s.billing} />,
  },
  "headcount-status": {
    title: "Headcount by status",
    render: (s) => (
      <HeadcountStatus
        counts={{
          active: s.employees.active,
          inactive: s.employees.inactive,
          invited: 0,
          suspended: 0,
        }}
      />
    ),
  },
  "monitoring-pending": {
    title: "Activity monitoring",
    render: () => <MonitoringPendingCard />,
  },
  // Agent-pending placeholders — static, honest "waiting on the desktop agent" cards.
  "productivity-heatmap": {
    title: "Productivity heatmap",
    render: () => <ProductivityHeatmapPendingCard />,
  },
  "team-comparison": {
    title: "Team comparison",
    render: () => <TeamComparisonPendingCard />,
  },
  "top-performers": {
    title: "Top performers",
    render: () => <TopPerformersPendingCard />,
  },
  "recent-alerts": {
    title: "Recent alerts",
    render: () => <RecentAlertsPendingCard />,
  },
};
