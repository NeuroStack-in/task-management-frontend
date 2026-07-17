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
} from "./components/real-widgets";
import type { DashboardSummary } from "./use-dashboard-summary";

/** The org dashboard's real, customizable widgets. Every one is live data or an honest placeholder. */
export type RealWidgetType =
  | "projects-overview"
  | "active-inactive"
  | "department-headcount"
  | "billing"
  | "headcount-status"
  | "monitoring-pending";

interface WidgetDef {
  title: string;
  render: (s: DashboardSummary) => ReactNode;
}

export const WIDGET_REGISTRY: Record<RealWidgetType, WidgetDef> = {
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
};
