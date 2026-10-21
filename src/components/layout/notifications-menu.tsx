"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import { useNotificationStore } from "@/stores/notification.store";
import { useUnsavedStore } from "@/stores/unsaved.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timeAgo } from "@/lib/format";
import { useNotifications } from "@/modules/notifications/use-notifications";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

export function NotificationsMenu() {
  const notifications = useNotificationStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  // Real feed (`GET /v1/notifications`) — and mark-read now actually persists. The demo seed is
  // gone: inventing events on a real account is worse than an empty bell.
  const { markAllRead, markRead, refresh, error, reload } = useNotifications();
  const router = useRouter();
  // Controlled, so following an item can close the menu behind it.
  const [open, setOpen] = useState(false);
  // The full page is gated on `notifications:view` (its nav entry); offer the link only to whoever
  // can open it.
  const canOpenAll = usePermissions().can("notifications:view");
  // Capped, so a busy inbox reads "99+" instead of a number that spills out of the dot (SHELL-12).
  const badge = unread > 99 ? "99+" : String(unread);

  /** Close the menu and navigate. Unsaved settings edits ask first; the settings layout navigates
   *  once confirmed (WP-347). */
  const go = (href: string) => {
    setOpen(false);
    if (useUnsavedStore.getState().requestLeave(href)) router.push(href);
  };
  /**
   * An item marks itself read and, when it has somewhere to go, goes there. It only ever marked read
   * — `href` was never used and the menu stayed open, so "Support replied" cleared a dot and nothing
   * else (QA audit 2026-10-08, WP-470).
   */
  const openItem = (id: string, href?: string) => {
    markRead(id);
    if (href) go(href);
  };

  return (
    // Refetch when the bell opens, so what's behind the dot is current the moment it's looked at
    // (a silent refresh — the poll loop keeps it fresh the rest of the time).
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread > 0 ? `Notifications, ${badge} unread` : "Notifications"}
          />
        }
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <Badge
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] tabular-nums"
          >
            {badge}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {/* Menu items, not plain buttons: the panel is a `role="menu"`, which may only own menu
              items — a list of buttons inside it was an invalid tree to a screen reader, and arrow
              keys could not reach them (QA audit 2026-10-08, WP-116). */}
          <DropdownMenuItem
            closeOnClick={false}
            className="h-7 gap-1 px-2 text-xs"
            onClick={markAllRead}
            disabled={unread === 0}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </DropdownMenuItem>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 && error ? (
            // A failed load is not "nothing new" — the bell said so with the API down.
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <p className="text-muted-foreground text-sm">
                Couldn&apos;t load notifications.
              </p>
              <DropdownMenuItem
                closeOnClick={false}
                className="h-7 border px-2 text-xs"
                onClick={reload}
              >
                Retry
              </DropdownMenuItem>
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No new notifications.
            </p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => openItem(n.id, n.href)}
                  className="hover:bg-accent flex w-full flex-col items-start gap-0.5 rounded-none px-3 py-2.5 text-left"
                >
                  <div className="flex w-full items-center gap-2">
                    {/* Read/unread was the dot's colour alone; the words are for a screen reader
                        (UX audit 2026-10-16, SHELL-20). */}
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-primary",
                      )}
                    >
                      {!n.read ? <span className="sr-only">Unread:</span> : null}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{n.title}</span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <span className="text-muted-foreground pl-4 text-xs">{n.message}</span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        {/* The whole feed, with filters — the bell had no way there (UX audit 2026-10-16,
            SHELL-12), and the sidebar no longer lists it (the bell is the way in). */}
        {canOpenAll ? (
          <div className="border-t p-1">
            <DropdownMenuItem
              className="justify-center gap-1.5 py-2 text-sm font-medium"
              onClick={() => go("/notifications")}
            >
              View all notifications <ArrowRight className="size-3.5" />
            </DropdownMenuItem>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
