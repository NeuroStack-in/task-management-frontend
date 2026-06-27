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
import { DEMO_NOTIFICATIONS, timeAgo } from "@/lib/mock-notifications";
import { cn } from "@/lib/utils";

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
          <Badge className="absolute -right-0.5 -top-0.5 min-w-4 justify-center rounded-sm px-1 text-[9px]">
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
              No new notifications.
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
