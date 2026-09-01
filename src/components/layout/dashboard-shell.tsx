"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/stores/ui.store";
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
 * content sits on the slate canvas with a subtle per-route fade-in. The mobile
 * nav sheet mounts here. See Docs/REDESIGN.md.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const pathname = usePathname();

  // Patch the store with the caller's real name (the JWT has none — see the hook).
  useHydrateProfile();

  // Settings has its own section rail, so collapse the main sidebar there to
  // free up width — and expand it again on every other route.
  useEffect(() => {
    setSidebarCollapsed(pathname.startsWith("/settings"));
  }, [pathname, setSidebarCollapsed]);

  return (
    <div className="flex min-h-screen bg-background">
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
        <main className="flex-1 px-4 pt-3 pb-3 sm:px-6 sm:pt-4">
          <div key={pathname} className="wp-enter">
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
