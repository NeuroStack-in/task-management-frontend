"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/stores/ui.store";
import { SidebarNav } from "./sidebar-nav";
import { TopNavbar } from "./top-navbar";
import { ChatBot } from "./chat-bot";
import { cn } from "@/lib/utils";

/**
 * Authenticated app shell. A floating, rounded sidebar panel sits on the warm
 * greige canvas; it collapses to an icon-only rail. Content cards float on the
 * same canvas. Mobile navigation lives in the navbar's sheet. See Docs/DESIGN.md.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const pathname = usePathname();

  // Settings has its own section rail, so collapse the main sidebar there to
  // free up width — and expand it again on every other route.
  useEffect(() => {
    setSidebarCollapsed(pathname.startsWith("/settings"));
  }, [pathname, setSidebarCollapsed]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden shrink-0 p-3 lg:block">
        <div
          className={cn(
            "sticky top-3 h-[calc(100vh-1.5rem)] transition-[width] duration-200",
            collapsed ? "w-[68px]" : "w-60",
          )}
        >
          <SidebarNav collapsed={collapsed} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar />
        {/* pb clears the fixed AI-assistant FAB (bottom-right) so it never
            covers page content like pagination controls. */}
        <main className="flex-1 px-4 pb-24 sm:px-6">{children}</main>
      </div>
      <ChatBot />
    </div>
  );
}
