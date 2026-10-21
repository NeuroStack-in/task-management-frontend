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
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@/types";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  {
    label: string;
    /** Lower-case singular for running text — "No task notifications" (UX audit SHELL-20). */
    noun: string;
    icon: LucideIcon;
    className: string;
  }
> = {
  task: { label: "Tasks", noun: "task", icon: ListTodo, className: "bg-feature-tint text-primary" },
  approval: {
    label: "Approvals",
    noun: "approval",
    icon: CheckCircle2,
    className: "bg-success/15 text-success",
  },
  // The server's `security` category (a two-factor reset) — it used to fold into System with the
  // generic bell, although Settings has a "Security alerts" toggle (WP-381).
  security: {
    label: "Security",
    noun: "security",
    icon: ShieldAlert,
    className: "bg-destructive/10 text-destructive",
  },
  productivity: {
    label: "Productivity",
    noun: "productivity",
    icon: TrendingDown,
    className: "bg-warning/15 text-warning",
  },
  billing: {
    label: "Billing",
    noun: "billing",
    icon: CreditCard,
    className: "bg-chart-2/15 text-chart-2",
  },
  system: {
    label: "System",
    noun: "system",
    icon: Bell,
    className: "bg-muted text-muted-foreground",
  },
};
