"use client";

import { useEffect, useState } from "react";
import { Menu, Search } from "lucide-react";
import { useUiStore } from "@/stores/ui.store";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { GlobalTimer } from "./global-timer";
import { ThemeSwitcher } from "./theme-switcher";
import { PaletteSwitcher } from "./palette-switcher";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openCommand = useUiStore((s) => s.setCommandOpen);

  // Show ⌘K on macOS, Ctrl K elsewhere. Detected post-mount to avoid a
  // hydration mismatch (server can't read the platform).
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 bg-background/85 px-4 backdrop-blur-md sm:px-6">
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

      {/* Search / command palette */}
      <button
        type="button"
        onClick={() => openCommand(true)}
        className="flex h-10 flex-1 items-center gap-2.5 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-soft transition-colors hover:text-foreground sm:max-w-sm"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search people, projects, reports…</span>
        <kbd className="pointer-events-none hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <div className="flex items-center gap-2.5 sm:ml-auto">
        <div className="rounded-full bg-card p-1 shadow-soft">
          <PaletteSwitcher />
        </div>
        <GlobalTimer />
        <div className="flex items-center gap-0.5 rounded-full bg-card p-1 shadow-soft">
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
        <div className="rounded-full bg-card shadow-soft">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
