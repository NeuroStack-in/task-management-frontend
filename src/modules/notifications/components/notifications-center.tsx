"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, Check, CheckCheck, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useNotificationStore } from "@/stores/notification.store";
import {
  DEMO_NOTIFICATIONS,
  NOTIFICATION_TYPE_META,
} from "@/lib/mock-notifications";
import type { AppNotification, NotificationType } from "@/types";
import { cn } from "@/lib/utils";

const TYPES: NotificationType[] = [
  "task",
  "approval",
  "productivity",
  "billing",
  "system",
];

/** Returns "Today", "Yesterday", or "Earlier" bucket for a timestamp. */
function dateBucket(ts: number): "Today" | "Yesterday" | "Earlier" {
  const now = new Date();
  const d = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yestStart = todayStart - 86_400_000;
  if (d.getTime() >= todayStart) return "Today";
  if (d.getTime() >= yestStart) return "Yesterday";
  return "Earlier";
}

function timeAgoLabel(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NotificationsCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const seed = useNotificationStore((s) => s.seed);

  const [filter, setFilter] = useState<NotificationType | "all" | "unread">(
    "all",
  );

  useEffect(() => {
    if (useNotificationStore.getState().notifications.length === 0) {
      seed(DEMO_NOTIFICATIONS);
    }
  }, [seed]);

  const unread = notifications.filter((n) => !n.read).length;

  const visible = useMemo(
    () =>
      notifications.filter((n) => {
        if (filter === "all") return true;
        if (filter === "unread") return !n.read;
        return n.type === filter;
      }),
    [notifications, filter],
  );

  /** Group visible notifications into Today / Yesterday / Earlier. */
  const groups = useMemo(() => {
    const buckets: Record<string, AppNotification[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const n of visible) {
      buckets[dateBucket(n.createdAt)].push(n);
    }
    return (["Today", "Yesterday", "Earlier"] as const).filter(
      (k) => buckets[k].length > 0,
    ).map((k) => ({ label: k, items: buckets[k] }));
  }, [visible]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Activity and alerts that need your attention."
        actions={
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Filter pills — compact row, two groups: read-state then type */}
        <div className="flex flex-wrap gap-2">
          <FilterPill
            label="All"
            count={notifications.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterPill
            label="Unread"
            count={unread || undefined}
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
          <span className="my-auto h-4 w-px bg-border" aria-hidden />
          {TYPES.map((t) => (
            <FilterPill
              key={t}
              label={NOTIFICATION_TYPE_META[t].label}
              active={filter === t}
              onClick={() => setFilter(t)}
            />
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="Nothing here"
            description="You're all caught up. New notifications will show up here."
          />
        ) : (
          <div className="space-y-4">
            {groups.map(({ label, items }) => (
              <section key={label}>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <Card className="p-0">
                  <ul className="divide-y">
                    {items.map((n) => {
                      const meta = NOTIFICATION_TYPE_META[n.type];
                      const Icon = meta.icon;
                      return (
                        <li
                          key={n.id}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50",
                            !n.read && "bg-feature-tint/40",
                          )}
                        >
                          {/* Unread dot or read spacer — no decorative icon square */}
                          <span className="mt-2 flex size-2 shrink-0 items-center justify-center">
                            {!n.read ? (
                              <span className="size-2 rounded-full bg-primary" />
                            ) : null}
                          </span>

                          {/* Type icon inline, small — not a coloured box */}
                          <Icon
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              n.read ? "text-muted-foreground" : "text-foreground",
                            )}
                            aria-hidden
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 truncate text-sm font-medium">
                                {n.title}
                              </span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {timeAgoLabel(n.createdAt)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {n.message}
                            </p>
                            <div className="mt-1.5 flex items-center gap-3">
                              {n.href ? (
                                <Link
                                  href={n.href}
                                  onClick={() => markRead(n.id)}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  View
                                </Link>
                              ) : null}
                              {!n.read ? (
                                <button
                                  type="button"
                                  onClick={() => markRead(n.id)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <Check className="size-3.5" /> Mark read
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground"
                            aria-label="Dismiss"
                            onClick={() => remove(n.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
      )}
    >
      {label}
      {count != null ? (
        <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
      ) : null}
    </button>
  );
}
