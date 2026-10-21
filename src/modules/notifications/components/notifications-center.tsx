"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BellOff,
  Check,
  CheckCheck,
  MoreHorizontal,
  SlidersHorizontal,
  X,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationStore } from "@/stores/notification.store";
import { useUnsavedStore } from "@/stores/unsaved.store";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { useNotifications } from "../use-notifications";
import { NOTIFICATION_TYPE_META } from "@/modules/notifications/lib/type-meta";
import {
  countByType,
  emptyCopy,
  typeFilters,
  type NotificationFilter,
} from "@/modules/notifications/lib/filters";
import { timeAgo } from "@/lib/format";
import type { NotificationType } from "@/types";
import type { PermissionId } from "@/types/rbac";
import { cn } from "@/lib/utils";

const TYPES: NotificationType[] = [
  "task",
  "approval",
  "security",
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
 * `approval` has now been wrong TWICE, in opposite directions, which is the lesson:
 *   1. Gated on `approvals:view` → employees never saw their own "leave approved".
 *   2. Gated on `leave:view` (contributor-only — the wildcard deliberately does NOT grant it) →
 *      Owners/Admins never saw "awaiting your approval" (found live 2026-07-25, the moment the
 *      approver fan-out shipped: the bell counted it, this page filtered it).
 * Both times the server had already targeted the notification correctly and the client's second
 * guess broke it. `approval` is therefore ungated: whatever the server addressed to you — your own
 * lifecycle as a requester, or a decision request as an approver — is yours to see. So is
 * `security` (your own two-factor reset).
 *
 * `billing` goes to whoever changed the plan, who held `BillingManage` to do it — which lights
 * `billing:view` — so its gate never hides a receipt from its addressee. `productivity` is not
 * produced by any consumer today; its gate is unexercised.
 */
const TYPE_PERMISSION: Record<NotificationType, PermissionId | null> = {
  task: null,
  system: null,
  approval: null,
  security: null,
  productivity: "reports:view",
  billing: "billing:view",
};

export function NotificationsCenter() {
  const notifications = useNotificationStore((s) => s.notifications);
  // Real feed + persisting mark-read (`GET /v1/notifications`). The backend serves read / read-all /
  // prefs and has no delete, so `dismiss` hides an item on this browser and marks it read — see the
  // note on `DISMISSED_KEY` in use-notifications.
  const { markRead, markAllRead, dismiss, loading, error, reload } = useNotifications();
  const { can } = usePermissions();

  const [filter, setFilter] = useState<NotificationFilter>("all");

  const router = useRouter();

  /**
   * A row goes where the bell's item goes (UX audit 2026-10-16, SHELL-13). It opened a dialog that
   * repeated the row's own title and text, with the real destination one more click away behind
   * "View details" — while the bell, for the same notification, went straight there. Now a row with
   * a target marks itself read and navigates; one without a target only marks itself read, because
   * its whole message is already on the row.
   */
  const openItem = (id: string, href?: string) => {
    markRead(id);
    if (!href) return;
    // Unsaved settings edits ask first; the settings layout navigates once confirmed (WP-347).
    if (useUnsavedStore.getState().requestLeave(href)) router.push(href);
  };

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

  // A type gets a filter only when the feed holds one of it (UX audit 2026-10-16, SHELL-20).
  const typeCounts = countByType(allowed);
  const shownTypes = typeFilters(TYPES.filter(canType), typeCounts, filter);

  // Publish the notification counts + active filter to the assistant.
  useAssistantPageContext({
    facts: [
      { label: "Total notifications", value: String(allowed.length) },
      { label: "Unread", value: String(unread) },
      { label: "Filter", value: filter },
      { label: "Showing", value: String(visible.length) },
    ],
  });

  return (
    // (Bottom room for the floating assistant button is the shell's now — `dashboard-shell.tsx`.)
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Everything that needs your attention."
        actions={
          <>
            <div className="hidden items-center gap-2 md:flex">
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
            {/* Below md the two buttons go into one "…" menu. Side by side in the top bar they
                pushed the page to ≈ 522 px on a 390 px phone and squeezed the title out entirely
                (UX audit 2026-10-16, EMP-05 / XC-04). */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                      aria-label="Notification actions"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem disabled={unread === 0} onClick={markAllRead}>
                    <CheckCheck className="size-4" /> Mark all read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings/notifications")}>
                    <SlidersHorizontal className="size-4" /> Notification preferences
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />

      {/* Feed */}
      <div className="space-y-4">
        {/* Filter pills — toggle buttons, so each says whether it is on (`aria-pressed`), not only
            its colour. */}
          <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-2">
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
            {shownTypes.map((t) => (
              <FilterPill
                key={t}
                label={`${NOTIFICATION_TYPE_META[t].label}${typeCounts.get(t) ? ` · ${typeCounts.get(t)}` : ""}`}
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
            // Said for the filter that is on (SHELL-20).
            <EmptyState
              icon={BellOff}
              {...emptyCopy(filter, allowed.length)}
              action={
                filter !== "all" && allowed.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                    Show all notifications
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="p-0 [--card-spacing:0px]">
              <ul className="divide-y">
                {visible.map((n) => {
                  const meta = NOTIFICATION_TYPE_META[n.type];
                  const Icon = meta.icon;
                  return (
                    // A click anywhere on the row opens it, for the mouse. The row is not itself a
                    // button: it holds real ones, and a row-level Enter/Space handler swallowed their
                    // keyboard activation (QA audit 2026-10-08, WP-244). Keyboard users reach the
                    // row's own "Open" link, Mark read and Dismiss.
                    <li
                      key={n.id}
                      onClick={() => openItem(n.id, n.href)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/50",
                        (n.href || !n.read) && "cursor-pointer",
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
                          {/* The dot is colour alone; the words are for a screen reader (SHELL-20). */}
                          {!n.read ? (
                            <span className="size-2 shrink-0 rounded-full bg-primary">
                              <span className="sr-only">Unread:</span>
                            </span>
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
                          {/* A real link: keyboard, middle-click and "open in new tab" all work. */}
                          {n.href ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2.5 text-xs"
                              nativeButton={false}
                              render={<Link href={n.href} />}
                              aria-label={`Open “${n.title}”`}
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(n.id);
                                // Same unsaved-edits guard as the row; a modified click (new tab)
                                // is left to the browser.
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                e.preventDefault();
                                openItem(n.id, n.href);
                              }}
                            >
                              Open <ArrowUpRight className="size-3.5" />
                            </Button>
                          ) : null}
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
                        aria-label={`Dismiss “${n.title}” on this device`}
                        title="Dismiss on this device"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
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
      aria-pressed={active}
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

