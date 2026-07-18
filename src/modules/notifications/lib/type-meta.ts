/**
 * Presentational metadata (label / icon / color) for each notification type.
 * Used by the navbar dropdown and the full Notification Center to render a
 * consistent icon + accent per category.
 */
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ListTodo,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@/types";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; icon: LucideIcon; className: string }
> = {
  task: { label: "Tasks", icon: ListTodo, className: "bg-feature-tint text-primary" },
  approval: {
    label: "Approvals",
    icon: CheckCircle2,
    className: "bg-success/15 text-success",
  },
  productivity: {
    label: "Productivity",
    icon: TrendingDown,
    className: "bg-warning/15 text-warning",
  },
  billing: {
    label: "Billing",
    icon: CreditCard,
    className: "bg-chart-2/15 text-chart-2",
  },
  system: { label: "System", icon: Bell, className: "bg-muted text-muted-foreground" },
};
