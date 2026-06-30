"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, PanelLeftClose, LogOut, Search } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useUiStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SidebarSearch } from "./sidebar-search";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const router = useRouter();
  const { nav } = usePermissions();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace("/login");
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
      <div className="flex h-full w-[68px] flex-col items-center overflow-hidden rounded-[1.6rem] bg-sidebar py-4 text-sidebar-foreground shadow-soft">
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
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
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
            <span className="flex size-10 items-center justify-center rounded-2xl text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Search className="size-[18px]" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">Search</TooltipContent>
        </Tooltip>

        <ScrollArea className="my-3 w-full min-h-0 flex-1">
          <nav className="flex flex-col items-center gap-1 px-2">
            {nav.map((group, gi) => (
              <div
                key={group.label}
                className="flex flex-col items-center gap-1"
              >
                {gi > 0 ? (
                  <span className="my-1 h-px w-7 bg-sidebar-border" />
                ) : null}
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
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log out"
                />
              }
            >
              <span className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <LogOut className="size-[18px]" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
          {user ? (
            <Avatar className="mt-1 size-9">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="text-xs">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-sidebar text-sidebar-foreground shadow-soft">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <span className="flex-1 font-display text-lg font-semibold tracking-tight">
          WorkPulse
        </span>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Collapse sidebar"
          className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
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
          {nav.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "border-l-2 border-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
