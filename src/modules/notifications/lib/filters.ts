/**
 * The Notification Center's filter row and empty-list copy, kept pure so they can be tested.
 */
import type { NotificationType } from "@/types";
import { NOTIFICATION_TYPE_META } from "./type-meta";

export type NotificationFilter = NotificationType | "all" | "unread";

/** How many notifications of each type the feed holds. */
export function countByType(items: ReadonlyArray<{ type: NotificationType }>) {
  const counts = new Map<NotificationType, number>();
  for (const n of items) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  return counts;
}

/**
 * The type filters worth offering, in `order`: only types the feed actually holds (UX audit
 * 2026-10-16, SHELL-20). Every type the role may see used to be offered, so "Productivity" — which
 * nothing on the server produces — was a filter that could never match, and the others led to an
 * empty list just as often. The `active` filter always stays, so dismissing its last item never
 * pulls the choice out from under the pointer.
 */
export function typeFilters(
  order: readonly NotificationType[],
  counts: ReadonlyMap<NotificationType, number>,
  active: NotificationFilter,
): NotificationType[] {
  return order.filter((t) => (counts.get(t) ?? 0) > 0 || active === t);
}

/**
 * What an empty list says, for the filter that produced it (SHELL-20). "You're all caught up" under
 * "Billing" claimed something about every notification while only one kind was being shown.
 */
export function emptyCopy(
  filter: NotificationFilter,
  total: number,
): { title: string; description: string } {
  if (filter === "all") {
    return { title: "No notifications", description: "New notifications will show up here." };
  }
  if (filter === "unread") {
    return {
      title: "You're all caught up",
      description: total > 0 ? "No unread notifications." : "New notifications will show up here.",
    };
  }
  return {
    title: `No ${NOTIFICATION_TYPE_META[filter].noun} notifications`,
    description: "New ones will show up here.",
  };
}
