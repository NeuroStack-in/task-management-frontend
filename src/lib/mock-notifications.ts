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
import type { PermissionId } from "@/types/rbac";

const MIN = 1000 * 60;
const HOUR = MIN * 60;

/**
 * A notification plus the permission required to receive it. Items with no
 * `requires` are personal — everyone gets them. Oversight items (approvals
 * awaiting *you*, team-level productivity dips, billing) only reach roles that
 * hold the gating permission, so an employee never sees their manager's queue.
 */
interface SeedNotification extends AppNotification {
  requires?: PermissionId;
}

/** Demo notifications. `createdAt` is relative to import time. */
const SEED: SeedNotification[] = [
  // ── Oversight: only for approvers / managers / finance ──
  {
    id: "seed-1",
    type: "approval",
    title: "Timesheet pending approval",
    message: "Priya Nair submitted a timesheet for last week.",
    read: false,
    createdAt: Date.now() - MIN * 12,
    href: "/approvals",
    requires: "approvals:view",
  },
  {
    id: "seed-3",
    type: "productivity",
    title: "Productivity dip detected",
    message: "Engineering · Backend is down 8% vs last week.",
    read: false,
    createdAt: Date.now() - HOUR * 3,
    href: "/insights/anomalies",
    requires: "activity:view",
  },
  {
    id: "seed-4",
    type: "approval",
    title: "Leave request awaiting review",
    message: "Marcus Lee requested 3 days off (Jul 8–10).",
    read: false,
    createdAt: Date.now() - HOUR * 5,
    href: "/approvals",
    requires: "approvals:view",
  },
  {
    id: "seed-5",
    type: "billing",
    title: "Invoice paid",
    message: "Your June invoice of $2,400 was charged successfully.",
    read: true,
    createdAt: Date.now() - HOUR * 9,
    href: "/billing",
    requires: "billing:view",
  },
  {
    id: "seed-8",
    type: "productivity",
    title: "Weekly team summary ready",
    message: "Your team's productivity report for this week is available.",
    read: true,
    createdAt: Date.now() - HOUR * 48,
    href: "/insights/reports",
    requires: "activity:view",
  },

  // ── Personal: everyone, including employees ──
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
    id: "seed-11",
    type: "task",
    title: "New task assigned to you",
    message: "You were assigned “Polish onboarding flow”.",
    read: false,
    createdAt: Date.now() - HOUR * 2,
    href: "/projects",
  },
  {
    id: "seed-9",
    type: "approval",
    title: "Your timesheet was approved",
    message: "Your timesheet for last week was approved.",
    read: false,
    createdAt: Date.now() - MIN * 40,
    href: "/time-tracking",
  },
  {
    id: "seed-10",
    type: "approval",
    title: "Time off approved",
    message: "Your leave request (Jul 8–10) was approved.",
    read: true,
    createdAt: Date.now() - HOUR * 7,
    href: "/leave",
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
    id: "seed-6",
    type: "system",
    title: "New device signed in",
    message: "A new sign-in from Chrome on Windows was detected.",
    read: true,
    createdAt: Date.now() - HOUR * 26,
    href: "/settings/security",
  },
];

/** Every demo notification (used only as a fallback). */
export const DEMO_NOTIFICATIONS: AppNotification[] = SEED;

/**
 * Notifications the current role should receive: all personal ones, plus any
 * oversight ones the role has permission for. Sorted newest-first.
 */
export function notificationsFor(
  can: (permission: PermissionId | null) => boolean,
): AppNotification[] {
  return SEED.filter((n) => !n.requires || can(n.requires)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

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
