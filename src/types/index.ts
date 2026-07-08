export type * from "./rbac";
export type * from "./user";

export type NotificationType =
  | "task"
  | "approval"
  | "productivity"
  | "billing"
  | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  href?: string;
}

export type TimerStatus = "idle" | "running" | "paused";

export interface ActiveTimerTask {
  taskId: string;
  taskTitle: string;
  projectName?: string;
}

export type WidgetType =
  | "productivity-trends"
  | "heatmap"
  | "team-comparison"
  | "attendance"
  | "active-inactive"
  | "headcount"
  | "screenshots"
  | "top-employees"
  | "ai-summary"
  | "billing"
  | "alerts-deadlines"
  | "upcoming-tasks";

export interface DashboardWidget {
  id: string;
  title: string;
  type: WidgetType;
  position: number;
  visible: boolean;
}
