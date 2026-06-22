"use client";

import { useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotificationStore } from "@/stores/notification.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppNotification } from "@/types";
import { cn } from "@/lib/utils";

const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "seed-1",
    type: "approval",
    title: "Timesheet pending approval",
    message: "Priya Nair submitted a timesheet for last week.",
    read: false,
    createdAt: Date.now() - 1000 * 60 * 12,
    href: "/approvals",
  },
  {
    id: "seed-2",
    type: "task",
    title: "Task due today",
    message: "“Finalize Q3 report” is due at 5:00 PM.",
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60,
    href: "/tasks",
  },
  {
    id: "seed-3",
    type: "productivity",
    title: "Productivity dip detected",
    message: "Engineering · Backend is down 8% vs last week.",
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    href: "/anomalies",
  },
];

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NotificationsMenu() {
  const notifications = useNotificationStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const seed = useNotificationStore((s) => s.seed);

  useEffect(() => {
    if (useNotificationStore.getState().notifications.length === 0) {
      seed(DEMO_NOTIFICATIONS);
    }
  }, [seed]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <Badge className="absolute -right-0.5 -top-0.5 size-4 justify-center rounded-full p-0 text-[10px]">
            {unread}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={markAllRead}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-accent"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          n.read ? "bg-transparent" : "bg-primary",
                        )}
                      />
                      <span className="flex-1 truncate text-sm font-medium">
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <span className="pl-4 text-xs text-muted-foreground">
                      {n.message}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
