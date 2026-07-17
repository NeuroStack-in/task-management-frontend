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
