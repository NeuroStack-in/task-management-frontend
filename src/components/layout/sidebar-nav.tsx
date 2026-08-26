"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, PanelLeftClose, LogOut, Search, LifeBuoy } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import type { NavGroup } from "@/constants/navigation";
import { useIsFeatureOffForOthers } from "@/hooks/use-features";
import { featureForHref } from "@/constants/features";
import { useOrgName } from "@/hooks/use-org";
import { useUiStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SidebarSearch } from "./sidebar-search";

/** The platform-support rail group, shown only to allowlisted operators (not permission-gated). */
const OPS_GROUP: NavGroup = {
  label: "Platform",
  items: [
    { label: "Support desk", href: "/ops/support", icon: LifeBuoy, permission: null },
  ],
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Must match `--rail-exit` in globals.css. */
const RAIL_EXIT_MS = 160;

/**
 * Sidebar navigation — a floating rounded panel on the greige canvas.
 * Two modes: expanded (grouped, labeled) and collapsed (icon-only rail with
 * tooltips, dark active square, avatar at the foot). The item list is generated
 * from the active role's permissions (TDD §8). The mobile sheet always uses the
 * expanded mode.
 */
export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const offForOthers = useIsFeatureOffForOthers();
  const { nav: baseNav, role } = usePermissions();
  // Platform-support operators get one extra rail group. It is NOT permission-driven (ops is a
  // cross-tenant identity outside the tenant RBAC model), so it's appended only when the server-side
  // allowlist confirms this account is an operator.
  const { isAdmin: isPlatformAdmin } = usePlatformAdmin();
  // A dedicated operator account (allowlisted, no customer permissions) sees ONLY the support desk;
  // an owner/admin who is also an operator keeps their full nav plus the ops group.
  const opsOnly = isPlatformAdmin && (role?.permissions.length ?? 0) === 0;
  const nav = useMemo(
    () =>
      opsOnly ? [OPS_GROUP] : isPlatformAdmin ? [...baseNav, OPS_GROUP] : baseNav,
    [baseNav, isPlatformAdmin, opsOnly],
  );
  const orgName = useOrgName();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Total stagger beats consumed by the nav: one per group heading, one per link.
  // The account rows at the foot continue the sequence from here.
  const navSteps = nav.reduce((n, g) => n + g.items.length + 1, 0);

  // Collapse runs in two beats — contents out, then the panel narrows — so the
  // labels never reflow against a shrinking edge. `exiting` holds the expanded
  // subtree mounted for the exit animation before the store flips.
  const [exiting, setExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  // A programmatic collapse (e.g. the /settings route rule) skips the exit
  // phase, so clear any stale flag it would otherwise re-expand into.
  useEffect(() => {
    if (collapsed) setExiting(false);
  }, [collapsed]);

  const startCollapse = () => {
    if (exiting) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setSidebarCollapsed(true);
      return;
    }
    setExiting(true);
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null;
      setExiting(false);
      setSidebarCollapsed(true);
    }, RAIL_EXIT_MS);
  };

  const handleLogout = () => {
    logout();
    // Hard navigation (not router.replace): a full reload discards all in-memory Zustand state, so
    // the next sign-in starts from a clean slate and re-hydrates from the server. `replace` (not
    // assign) drops the just-left app page from history, so a Back press after logout can't restore
    // a now-signed-out page from bfcache.
    window.location.replace("/login");
  };

  // Collapsed rail: expand the sidebar and focus its inline search field rather
  // than opening the command palette (the inline search shows live suggestions).
  const openSearch = () => {
    onNavigate?.();
    setSidebarCollapsed(false);
    requestSearchFocus();
  };

  if (collapsed) {
    return (
      // The panel is `w-full` so it tracks the wrapper's width tween rather than
      // snapping narrow on frame one, but the rail inside is pinned to its final
      // 68px and left-aligned — otherwise `items-center` would centre the icons
      // in the still-240px panel and drag them leftward as it closes. The panel
      // keeps its background from frame one; only the rail fades in (`key`
      // remounts it, replaying `wp-fade`), so the canvas never flashes through.
      <div
        key="collapsed"
        className="bg-sidebar text-sidebar-foreground shadow-soft flex h-full w-full overflow-hidden rounded-[1.6rem]"
      >
        <div className="wp-fade flex h-full w-[68px] shrink-0 flex-col items-center py-4">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                />
              }
            >
              <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-md">
                <Activity className="size-5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label="Search"
                  className="mt-3"
                />
              }
            >
              <span className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex size-10 items-center justify-center rounded-2xl">
                <Search className="size-[18px]" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Search</TooltipContent>
          </Tooltip>

          <ScrollArea className="my-3 min-h-0 w-full flex-1">
            <nav className="flex flex-col items-center gap-1 px-2">
              {nav.map((group, gi) => (
                <div key={group.label} className="flex flex-col items-center gap-1">
                  {gi > 0 ? <span className="bg-sidebar-border my-1 h-px w-7" /> : null}
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger
                          render={
                            <Link
                              href={item.href}
                              onClick={onNavigate}
                              aria-current={active ? "page" : undefined}
                              aria-label={item.label}
                              data-tour={`nav:${item.href}`}
                            />
                          }
                        >
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-md transition-colors",
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <Icon className="size-[18px]" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </nav>
          </ScrollArea>

          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button type="button" onClick={handleLogout} aria-label="Log out" />
                }
              >
                <span className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex size-10 items-center justify-center rounded-md">
                  <LogOut className="size-[18px]" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
            {user ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/settings/profile"
                      onClick={onNavigate}
                      aria-label="Profile"
                      className="mt-1"
                    />
                  }
                >
                  <Avatar className="size-9">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">Profile</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      key="expanded"
      className="wp-fade bg-sidebar text-sidebar-foreground shadow-soft flex h-full w-full flex-col overflow-hidden rounded-[1.4rem]"
    >
      {/* Content column. On collapse this leaves first (`wp-rail-out`) while the
          panel behind it keeps its background, so the width tween that follows
          closes an already-empty rail instead of crushing live text. */}
      <div
        className={cn("flex h-full min-h-0 w-full flex-col", exiting && "wp-rail-out")}
      >
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
            <Activity className="size-5" />
          </div>
          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="font-display truncate text-lg leading-tight font-semibold tracking-tight">
              WorkPulse
            </span>
            {orgName ? (
              <span className="text-muted-foreground truncate text-xs leading-tight">
                {orgName}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={startCollapse}
            aria-label="Collapse sidebar"
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hidden size-8 items-center justify-center rounded-lg lg:flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Inline global search with live suggestions (people, projects, pages) */}
        <div className="px-3 pb-3">
          <SidebarSearch onNavigate={onNavigate} />
        </div>

        <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
          <nav className="flex flex-col gap-5">
            {nav.map((group, groupIndex) => {
              // Each group contributes its label plus its items to the running
              // stagger index, so the sweep runs continuously down the whole rail
              // instead of restarting at every group heading.
              const groupStart = nav
                .slice(0, groupIndex)
                .reduce((n, g) => n + g.items.length + 1, 0);
              return (
                <div key={group.label}>
                  <p
                    className="wp-rail-item text-muted-foreground/80 px-3 pb-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase"
                    style={{ "--wp-i": groupStart } as React.CSSProperties}
                  >
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item, itemIndex) => {
                      const active = isActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <li
                          key={item.href}
                          className="wp-rail-item"
                          style={
                            {
                              "--wp-i": groupStart + itemIndex + 1,
                            } as React.CSSProperties
                          }
                        >
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            data-tour={`nav:${item.href}`}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              active
                                ? "border-primary bg-sidebar-accent text-sidebar-accent-foreground border-l-2 font-medium"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                            {/* Owner-only: this feature is switched off org-wide and the Owner is
                                the sole exemption. Without a marker they would have no way to tell
                                which surfaces their team can actually see. */}
                            {offForOthers(featureForHref(item.href)) ? (
                              <span
                                title="Switched off for everyone else"
                                className="bg-warning/15 text-warning ml-auto shrink-0 rounded-full px-1.5 py-px text-[0.6rem] font-semibold"
                              >
                                OFF
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Account — profile + log out, pinned to the foot of the sidebar. These
          pick up where the nav left off so the sweep runs the full height. */}
        <div className="border-sidebar-border space-y-0.5 border-t p-3">
          {user ? (
            <Link
              href="/settings/profile"
              onClick={onNavigate}
              aria-current={isActive(pathname, "/settings/profile") ? "page" : undefined}
              style={{ "--wp-i": navSteps } as React.CSSProperties}
              className={cn(
                "wp-rail-item flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
                isActive(pathname, "/settings/profile")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {role?.name ?? "View profile"}
                </p>
              </div>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            style={{ "--wp-i": navSteps + 1 } as React.CSSProperties}
            className="wp-rail-item text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="truncate">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
