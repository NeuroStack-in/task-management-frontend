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

      {/* Global search — a compact trigger that opens the ⌘K command palette
          (jump to any page, person, project, or setting). Not an inline search
          field; the palette is the global navigator. */}
      <button
        type="button"
        onClick={() => openCommand(true)}
        aria-label="Open global search"
        aria-keyshortcuts="Meta+K Control+K"
        className="group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="pointer-events-none ml-1 hidden rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2.5">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
        <div className="rounded-md border border-border bg-card">
          <GlobalTimer />
        </div>
        <div className="rounded-md border border-border">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
