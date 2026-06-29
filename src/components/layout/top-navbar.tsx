"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePermissions } from "@/hooks/use-permissions";
import { titleForPath } from "@/lib/rbac";
import { usePageHeaderStore } from "@/stores/page-header.store";
import { SidebarNav } from "./sidebar-nav";
import { GlobalTimer } from "./global-timer";
import { ThemeSwitcher } from "./theme-switcher";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { can } = usePermissions();
  const pathname = usePathname();
  // Pages publish their title/subtitle (incl. record names on detail routes);
  // fall back to the route's nav label before the page mounts.
  const pageTitle = usePageHeaderStore((s) => s.title);
  const pageDescription = usePageHeaderStore((s) => s.description);
  // Every Settings sub-page shares one section header — the navbar always reads
  // "Settings" (the rail carries the sub-section), so it doesn't flip to
  // "Profile"/"Notifications"/etc. as you move between settings panes. The
  // sub-section subtitle lives in the content pane, not here.
  const isSettings = pathname.startsWith("/settings");
  const title = isSettings ? "Settings" : (pageTitle ?? titleForPath(pathname));
  const description = isSettings ? null : pageDescription;
  // The timer is only for people who log their own time — oversight roles
  // (Owner/Admin/HR/Manager) never see it.
  const showTimer = can("time-tracking:edit");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-md border border-border bg-card hover:bg-card lg:hidden"
              aria-label="Open menu"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-0 bg-transparent p-3 shadow-soft">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Active page title + subtitle (the page keeps an sr-only <h1>) */}
      {title ? (
        <div className="min-w-0">
          <span className="block truncate text-lg font-semibold leading-tight tracking-tight">
            {title}
          </span>
          {description ? (
            <span className="hidden truncate text-xs leading-tight text-muted-foreground sm:block">
              {description}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Right cluster (search lives in the sidebar) */}
      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
        {showTimer ? (
          <div className="rounded-md border border-border bg-card">
            <GlobalTimer />
          </div>
        ) : null}
        <div className="rounded-md border border-border">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
