"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BellOff,
  Check,
  CheckCheck,
  SlidersHorizontal,
  X,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
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
import { usePermissions } from "@/hooks/use-permissions";
import { useNotifications } from "../use-notifications";
import { NOTIFICATION_TYPE_META, timeAgo } from "@/lib/mock-notifications";
import type { AppNotification, NotificationType } from "@/types";
import type { PermissionId } from "@/types/rbac";
import { cn } from "@/lib/utils";

const TYPES: NotificationType[] = [
  "task",
  "approval",
  "productivity",
  "billing",
  "system",
];

/**
 * Which permission each notification type requires to be shown. `null` = visible to everyone.
 *
 * **Every notification the backend writes is self-targeted.** `notifications/src/consumers.rs`
 * fans out to a single target user — the subject of the event — so nothing in this feed is an
 * org-level alert about someone else. This table is therefore a *narrowing* of an already
 * self-scoped feed, and each gate has to be justified against that, not against the type's name.
 *
 * `approval` is the live case, and it was wrong: the server tags a user's **own** leave lifecycle
 * (`leave_requested` / `leave_approved` / `leave_cancelled`) as `approval`, but this required
 * `approvals:view` — a Manager/Admin permission an Employee does not hold. The result was an
 * employee never seeing their own leave approved: the server sent it, the UI filtered it out, and
 * nothing errored. It asks "may you see YOUR leave?", so it gates on `leave:view`.
 *
 * `productivity` and `billing` are not produced by any consumer today; their gates are unexercised
 * and should be re-checked against the real category the day something starts emitting them.
 */
const TYPE_PERMISSION: Record<NotificationType, PermissionId | null> = {
  task: null,
  system: null,
  approval: "leave:view",
  productivity: "reports:view",
  billing: "billing:view",
};

export function NotificationsCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  // Real feed + persisting mark-read (`GET /v1/notifications`). `remove` stays store-local:
  // the backend serves read / read-all / prefs and has no delete, so a dismissed notification
  // comes back on reload. See the module note.
  const { markRead, markAllRead, loading, error, reload } = useNotifications();
  const remove = useNotificationStore((s) => s.remove);
  const { can } = usePermissions();

  const [filter, setFilter] = useState<NotificationType | "all" | "unread">(
    "all",
  );

  const router = useRouter();
  const [selected, setSelected] = useState<AppNotification | null>(null);


  const canType = (t: NotificationType) => {
    const perm = TYPE_PERMISSION[t];
    return perm === null || can(perm);
  };

  // Restrict the feed to notification types the current role may see.
  const allowed = notifications.filter((n) => canType(n.type));
  const unread = allowed.filter((n) => !n.read).length;

  const visible = allowed.filter((n) => {
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/settings/notifications" />}
            >
              <SlidersHorizontal className="size-4" /> Preferences
            </Button>
            <Button
              variant="outline"
              onClick={markAllRead}
              disabled={unread === 0}
            >
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          </div>
        }
      />

      {/* Feed */}
      <div className="space-y-4">
        {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            <FilterPill
              label={`All${allowed.length ? ` · ${allowed.length}` : ""}`}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterPill
              label={`Unread${unread ? ` · ${unread}` : ""}`}
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
            />
            {TYPES.filter(canType).map((t) => (
              <FilterPill
                key={t}
                label={NOTIFICATION_TYPE_META[t].label}
                active={filter === t}
                onClick={() => setFilter(t)}
              />
            ))}
          </div>

          {loading && notifications.length === 0 ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader label="Loading notifications…" />
            </div>
          ) : error && notifications.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Couldn't load notifications"
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={reload}>
                  Retry
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={BellOff}
              title="Nothing here"
              description="You're all caught up. New notifications will show up here."
            />
          ) : (
            <Card className="p-0 [--card-spacing:0px]">
              <ul className="divide-y">
                {visible.map((n) => {
                  const meta = NOTIFICATION_TYPE_META[n.type];
                  const Icon = meta.icon;
                  return (
                    <li
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        markRead(n.id);
                        setSelected(n);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          markRead(n.id);
                          setSelected(n);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
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
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.id);
                              setSelected(n);
                            }}
                          >
                            View
                          </Button>
                          {!n.read ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2.5 text-xs text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(n.id);
                              }}
                            >
                              <Check className="size-3.5" /> Mark read
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        aria-label="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n.id);
                        }}
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

