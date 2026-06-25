"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Check, CheckCheck, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useNotificationStore } from "@/stores/notification.store";
import {
  DEMO_NOTIFICATIONS,
  NOTIFICATION_TYPE_META,
  timeAgo,
} from "@/lib/mock-notifications";
import type { NotificationType } from "@/types";
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
        description="Everything that needs your attention, plus delivery preferences."
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

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Feed */}
        <div className="space-y-4 lg:col-span-2">
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
          )}
        </div>

        {/* Preferences */}
        <PreferencesCard />
      </div>
    </div>
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

function PreferencesCard() {
  const [prefs, setPrefs] = useState<
    Record<NotificationType, { email: boolean; push: boolean }>
  >({
    task: { email: true, push: true },
    approval: { email: true, push: true },
    productivity: { email: false, push: true },
    billing: { email: true, push: false },
    system: { email: false, push: true },
  });

  const toggle = (type: NotificationType, channel: "email" | "push") =>
    setPrefs((p) => ({
      ...p,
      [type]: { ...p[type], [channel]: !p[type][channel] },
    }));

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" /> Preferences
        </CardTitle>
        <CardDescription>Choose how each type reaches you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Type</span>
          <span className="flex gap-4">
            <span className="w-10 text-center">Email</span>
            <span className="w-10 text-center">Push</span>
          </span>
        </div>
        {TYPES.map((t) => (
          <div key={t} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{NOTIFICATION_TYPE_META[t].label}</Badge>
            </span>
            <span className="flex gap-4">
              <span className="flex w-10 justify-center">
                <Switch
                  checked={prefs[t].email}
                  onCheckedChange={() => toggle(t, "email")}
                />
              </span>
              <span className="flex w-10 justify-center">
                <Switch
                  checked={prefs[t].push}
                  onCheckedChange={() => toggle(t, "push")}
                />
              </span>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
