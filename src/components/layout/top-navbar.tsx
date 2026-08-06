"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePageHeaderStore } from "@/stores/page-header.store";
import { useAgentRelease } from "@/hooks/use-agent-release";
import { SidebarNav } from "./sidebar-nav";
import { GlobalTimer } from "./global-timer";
import { ThemeSwitcher } from "./theme-switcher";
import { NotificationsMenu } from "./notifications-menu";

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  // Pages (e.g. the Dashboard greeting) publish their title/subtitle here so the
  // navbar carries it at the top — the page keeps an sr-only <h1>.
  const title = usePageHeaderStore((s) => s.title);
  const description = usePageHeaderStore((s) => s.description);

  // "A newer agent than the one you were last told about." The version comes from the release
  // manifest the pipeline writes, so this needs no code change per release — see `useAgentRelease`.
  const {
    version: agentVersion,
    isNew: hasNewAgent,
    acknowledge: acknowledgeAgentRelease,
  } = useAgentRelease();

  return (
    <header className="bg-background/85 sticky top-0 z-30 flex h-20 items-center gap-3 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="bg-card shadow-soft hover:bg-card size-10 rounded-full lg:hidden"
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
        // `data-tour` anchor for the guided walkthroughs. This is the one element present on every
        // route for every role, so it's the reliable "you are here" target — unlike the dashboard's
        // GreetingHeader, which renders null and only publishes into this store.
        <div className="min-w-0" data-tour="page:header">
          <span className="font-display block truncate text-3xl leading-tight font-semibold tracking-tight">
            {title}
          </span>
          {description ? (
            <span className="text-muted-foreground mt-0.5 hidden truncate text-base leading-tight sm:block">
              {description}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-2.5">
        {/* Page actions (e.g. the Time Tracking My time/Team toggle) portal in
            here, on the same row as the title. */}
        <div id="wp-page-actions" className="flex items-center gap-2 empty:hidden" />
        {/*
          The palette switcher was removed from the chrome (2026-07-21): the product ships one
          palette — `teal`, "Slate & Teal / Calm · HR-grade" — set in `layout.tsx`'s pre-paint
          script. Letting every user repaint the whole app was a demo affordance, not a feature.

          `PaletteSwitcher` and the full `PALETTES` list are deliberately **kept** in
          `components/layout/palette-switcher.tsx`: the other schemes are still valid design tokens
          and are reachable by setting `data-palette` on `<html>`. To bring the control back, render
          `<PaletteSwitcher />` here again — nothing else was deleted.
        */}
        {/* Get the desktop agent. Reachable from anywhere by any signed-in user
            (the /settings/agents management view is admin-gated; the download
            page is not). Hidden on the download page itself. */}
        {pathname !== "/download" ? (
          <Button
            render={<Link href="/download" />}
            nativeButton={false}
            size="sm"
            // `relative` anchors the dot; `overflow-visible` because the pill's rounded-full clips
            // the badge that sits proud of its top-right corner.
            className="shadow-soft relative gap-1.5 overflow-visible rounded-full"
            // Acknowledging on click, not on arrival at /download, is deliberate: the click is the
            // moment the user has actually seen the announcement. Tying it to the destination would
            // also dismiss it for anyone who reaches the page by any other route, and would leave the
            // dot up for someone who clicked but never finished navigating.
            onClick={acknowledgeAgentRelease}
            aria-label={
              hasNewAgent
                ? `Download agent — version ${agentVersion} available`
                : "Download agent"
            }
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Download agent</span>
            {hasNewAgent ? (
              <>
                {/* The version rides the button on wide screens — "something is new" is a weaker
                    message than "0.1.7 is out", and it costs no extra row. */}
                <span className="bg-primary-foreground/20 ml-0.5 hidden rounded-full px-1.5 py-px text-[0.65rem] font-semibold tabular-nums lg:inline">
                  v{agentVersion}
                </span>
                {/* Below lg the label has no room, so the state degrades to a dot rather than
                    disappearing. `aria-hidden` — the accessible name above already says it, and a
                    screen reader should not hear a decorative dot twice. */}
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 flex size-2.5 lg:hidden"
                >
                  <span className="bg-destructive/70 absolute inline-flex size-full animate-ping rounded-full" />
                  <span className="bg-destructive ring-background relative inline-flex size-2.5 rounded-full ring-2" />
                </span>
              </>
            ) : null}
          </Button>
        ) : null}
        {/* The running-session timer lives in the navbar everywhere EXCEPT the
            dashboard, where the employee dashboard promotes it to a hero KPI tile
            (see TimerStatCard) — so it isn't shown twice. */}
        {pathname !== "/dashboard" ? <GlobalTimer /> : null}
        <div className="bg-card shadow-soft flex items-center gap-0.5 rounded-full p-1">
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
