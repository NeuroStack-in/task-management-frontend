"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { isSidebarCollapsed, useUiStore } from "@/stores/ui.store";
import { useHydrateProfile } from "@/modules/profile/use-hydrate-profile";
import { SidebarNav } from "./sidebar-nav";
import { TopNavbar } from "./top-navbar";
import { ChatBot } from "./chat-bot";
import { ProductTour } from "./product-tour";
import { FirstRunGate } from "@/modules/onboarding/components/first-run-gate";
import { cn } from "@/lib/utils";

/**
 * Authenticated app shell (Meridian). A full-height inset sidebar meets the
 * viewport edge with a hairline border and collapses to an icon-only rail;
 * content sits on the slate canvas with a subtle per-section fade-in. The mobile
 * nav sheet mounts here. See Docs/REDESIGN.md.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore(isSidebarCollapsed);
  const setInSettings = useUiStore((s) => s.setInSettings);
  const pathname = usePathname();

  // Patch the store with the caller's real name (the JWT has none — see the hook).
  useHydrateProfile();

  // Settings has its own section rail, so the main sidebar starts collapsed there to free up width.
  // That's a default for the visit (see `ui.store`), not a write over the user's own collapse choice,
  // which every other page — and a reload — keeps. Layout effect, so the first frame is already right.
  useLayoutEffect(() => {
    setInSettings(pathname.startsWith("/settings"));
  }, [pathname, setInSettings]);

  /**
   * The entrance animation replays when the **section** changes, not on every navigation. Keyed on
   * the full pathname, this wrapper remounted the nested layouts beneath it on each sub-navigation —
   * the Settings rail jumped back to its top and lost its scroll and dialog state, and the Analytics
   * tab bar replayed its entrance on every tab (QA audit 2026-10-08, WP-359).
   */
  const section = pathname.split("/")[1] ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* First in tab order: past the sidebar's search, links and account controls in one keypress. */}
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only z-[60] rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <aside className="hidden shrink-0 py-3 pl-3 lg:block">
        <div
          className={cn(
            "sticky top-3 h-[calc(100vh-1.5rem)] transition-[width] duration-base ease-standard",
            collapsed ? "w-[68px]" : "w-60",
          )}
        >
          <SidebarNav collapsed={collapsed} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar />
        {/* Tight bottom padding so content ends level with the sidebar's bottom
            edge; the translucent, draggable AI FAB overlays the corner. The keyed
            wrapper gives each route a subtle fade-up entrance (disabled under
            reduced-motion). */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pt-3 pb-3 outline-none sm:px-6 sm:pt-4"
        >
          <div key={section} className="wp-enter">
            {children}
          </div>
        </main>
      </div>
      <ChatBot />
      {/* Mounted in the shell, not on the Help page: a tour's later steps live on other routes, by
          which point the Help page has unmounted and would take the tour with it. */}
      <ProductTour />
      {/* Renders nothing unless this account's profile is missing a required field. */}
      <FirstRunGate />
    </div>
  );
}
