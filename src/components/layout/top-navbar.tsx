"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePageHeaderStore } from "@/stores/page-header.store";
import { SidebarNav } from "./sidebar-nav";
import { GlobalTimer } from "./global-timer";
import { ThemeSwitcher } from "./theme-switcher";
import { PaletteSwitcher } from "./palette-switcher";
import { NotificationsMenu } from "./notifications-menu";

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Pages (e.g. the Dashboard greeting) publish their title/subtitle here so the
  // navbar carries it at the top — the page keeps an sr-only <h1>.
  const title = usePageHeaderStore((s) => s.title);
  const description = usePageHeaderStore((s) => s.description);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-3 bg-background/85 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full bg-card shadow-soft hover:bg-card lg:hidden"
              aria-label="Open menu"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-0 bg-transparent p-3">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Active page title with its subtitle beneath it; the whole block is
          vertically centered in the bar, level with the right-hand controls. */}
      {title ? (
        <div className="min-w-0">
          <span className="block truncate font-display text-3xl font-semibold leading-tight tracking-tight">
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 hidden truncate text-base leading-tight text-muted-foreground sm:block">
              {description}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2.5">
        {/* Page actions (e.g. the Time Tracking My time/Team toggle) portal in
            here, on the same row as the title. */}
        <div id="wp-page-actions" className="flex items-center gap-2 empty:hidden" />
        <div className="rounded-full bg-card p-1 shadow-soft">
          <PaletteSwitcher />
        </div>
        <GlobalTimer />
        <div className="flex items-center gap-0.5 rounded-full bg-card p-1 shadow-soft">
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
