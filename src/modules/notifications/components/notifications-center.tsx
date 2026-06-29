"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, Check, CheckCheck, X, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useNotificationStore } from "@/stores/notification.store";
import {
  DEMO_NOTIFICATIONS,
  NOTIFICATION_TYPE_META,
  timeAgo,
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

export function NotificationsCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const seed = useNotificationStore((s) => s.seed);

  const [filter, setFilter] = useState<NotificationType | "all" | "unread">(
    "all",
  );

  const router = useRouter();
  const [selected, setSelected] = useState<AppNotification | null>(null);

  // Seed if the user lands here before opening the navbar dropdown.
  useEffect(() => {
    if (useNotificationStore.getState().notifications.length === 0) {
      seed(DEMO_NOTIFICATIONS);
    }
  }, [seed]);

  const unread = notifications.filter((n) => !n.read).length;

  const visible = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Everything that needs your attention."
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

      {/* Feed */}
      <div className="space-y-4">
        {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            <FilterPill
              label={`All${notifications.length ? ` · ${notifications.length}` : ""}`}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterPill
              label={`Unread${unread ? ` · ${unread}` : ""}`}
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
            />
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
            <Card className="p-0">
              <ul className="divide-y">
                {visible.map((n) => {
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
                      <span
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                          meta.className,
                        )}
                      >
                        <Icon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!n.read ? (
                            <span className="size-2 shrink-0 rounded-full bg-primary" />
                          ) : null}
                          <span className="flex-1 truncate text-sm font-medium">
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {n.message}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              markRead(n.id);
                              setSelected(n);
                            }}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View
                          </button>
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
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          {selected ? (
            <NotificationDialog
              notification={selected}
              onView={() => {
                if (selected.href) router.push(selected.href);
                setSelected(null);
              }}
            />
          ) : null}
        </Dialog>
      </div>
  );
}

function NotificationDialog({
  notification,
  onView,
}: {
  notification: AppNotification;
  onView: () => void;
}) {
  const meta = NOTIFICATION_TYPE_META[notification.type];
  const Icon = meta.icon;
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              meta.className,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base leading-snug">
              {notification.title}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {meta.label} · {timeAgo(notification.createdAt)}
            </p>
          </div>
        </div>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">{notification.message}</p>

      <DialogFooter showCloseButton>
        {notification.href ? (
          <Button onClick={onView}>
            View details <ArrowUpRight className="size-4" />
          </Button>
        ) : null}
      </DialogFooter>
    </DialogContent>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

