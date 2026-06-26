/**
 * Shared seed + metadata for notifications. Imported by both the navbar dropdown
 * (mini view) and the full Notification Center page, so there's a single source
 * of truth for the demo notifications (no duplicate lists).
 */
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ListTodo,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AppNotification, NotificationType } from "@/types";

const MIN = 1000 * 60;
const HOUR = MIN * 60;

/** Demo notifications. `createdAt` is relative to import time. */
export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "seed-1",
    type: "approval",
    title: "Timesheet pending approval",
    message: "Priya Nair submitted a timesheet for last week.",
    read: false,
    createdAt: Date.now() - MIN * 12,
    href: "/approvals",
  },
  {
    id: "seed-2",
    type: "task",
    title: "Task due today",
    message: "“Finalize Q3 report” is due at 5:00 PM.",
    read: false,
    createdAt: Date.now() - HOUR,
    href: "/projects",
  },
  {
    id: "seed-3",
    type: "productivity",
    title: "Productivity dip detected",
    message: "Engineering · Backend is down 8% vs last week.",
    read: false,
    createdAt: Date.now() - HOUR * 3,
    href: "/insights/anomalies",
  },
  {
    id: "seed-4",
    type: "approval",
    title: "Leave request awaiting review",
    message: "Marcus Lee requested 3 days off (Jul 8–10).",
    read: false,
    createdAt: Date.now() - HOUR * 5,
    href: "/approvals",
  },
  {
    id: "seed-5",
    type: "billing",
    title: "Invoice paid",
    message: "Your June invoice of $2,400 was charged successfully.",
    read: true,
    createdAt: Date.now() - HOUR * 9,
    href: "/billing",
  },
  {
    id: "seed-6",
    type: "system",
    title: "New device signed in",
    message: "A new sign-in from Chrome on Windows was detected.",
    read: true,
    createdAt: Date.now() - HOUR * 26,
    href: "/settings/security",
  },
  {
    id: "seed-7",
    type: "task",
    title: "You were mentioned",
    message: "Aisha tagged you on “Checkout flow — payment step”.",
    read: true,
    createdAt: Date.now() - HOUR * 30,
    href: "/projects",
  },
  {
    id: "seed-8",
    type: "productivity",
    title: "Weekly summary ready",
    message: "Your team's productivity report for this week is available.",
    read: true,
    createdAt: Date.now() - HOUR * 48,
    href: "/insights/reports",
  },
];

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

/** Minutes/hours/days-ago label. */
export function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
