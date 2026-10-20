"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Menu, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { usePageHeaderStore } from "@/stores/page-header.store";
import { useUiStore } from "@/stores/ui.store";
import { titleForPath } from "@/lib/rbac";
import { useAgentRelease } from "@/hooks/use-agent-release";
import { useTrackingMode } from "@/hooks/use-features";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { useMyDevices } from "@/modules/dashboard/use-my-devices";
import { desktopAppBehind, hasDesktopApp } from "@/modules/dashboard/lib/device-status";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar-nav";
import { isTypingTarget } from "./sidebar-search";
import { GlobalTimer } from "./global-timer";
import { ThemeSwitcher } from "./theme-switcher";
import { NotificationsMenu } from "./notifications-menu";
import { AssistantTopBarButton } from "./chat-bot";

/** Below `sm` — the phone layout, where page actions may fold into "⋯" (UX audit XC-04). */
const PHONE_QUERY = "(max-width: 639.98px)";
/** Below `lg` the sidebar is the nav sheet behind the menu button. */
const DESKTOP_NAV_QUERY = "(min-width: 1024px)";

/** A dialog, alert or sheet other than the nav sheet is open — a search shortcut must not fire under it. */
function modalOpen(): boolean {
  return !!document.querySelector(
    '[data-slot="dialog-content"], [role="alertdialog"], [data-slot="sheet-content"]:not([data-nav-sheet])',
  );
}

export function TopNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const mode = useTrackingMode();
  const personalDashboard = useIsPersonalDashboard();
  // Pages (e.g. the Dashboard greeting) publish their title/subtitle here so the
  // navbar carries it at the top — the page keeps an sr-only <h1>. When none has (the store's
  // documented `null` = "use the route fallback"), the route's own nav label stands in: the access
  // walls ("Access denied", "This page is turned off", upgrade notices) never mount a page, so they
  // used to show an empty title bar, and the product tour's `page:header` anchor vanished with it
  // (QA audit 2026-10-08, WP-548).
  const publishedTitle = usePageHeaderStore((s) => s.title);
  const title = publishedTitle ?? titleForPath(pathname);
  const description = usePageHeaderStore((s) => s.description);

  // "A newer agent than the one you were last told about." The version comes from the release
  // manifest the pipeline writes, so this needs no code change per release — see `useAgentRelease`.
  const {
    version: agentVersion,
    isNew: unseenRelease,
    acknowledge: acknowledgeAgentRelease,
  } = useAgentRelease();

  /**
   * The caller's own devices decide what the download chip says (UX audit 2026-10-16, EMP-09). It
   * read "Download agent v0.1.30" — a pulsing red dot on a phone — whether the desktop app was
   * installed or not:
   *   - app installed and current → no chip; there is nothing to download.
   *   - app installed but behind the release → "Update", with the version, once per release.
   *   - no app → "Download agent", with no "new version" cue: a first install is not an update.
   *   - unknown (a server without `GET /v1/me/devices`, or a failed read) → "Download agent", no cue
   *     — we can't tell whether a release is news to this person, so it isn't announced.
   */
  const { devices } = useMyDevices();
  const hasApp = hasDesktopApp(devices);
  const appBehind = desktopAppBehind(devices, agentVersion);
  const showUpdateCue = appBehind && unseenRelease;
  const showDownloadChip =
    pathname !== "/download" && mode !== "machine" && !(hasApp === true && !appBehind);

  /* ── Search: ⌘K / Ctrl+K / "/" anywhere, and a button on screens without the sidebar ──────── */
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const requestSearchFocus = useUiStore((s) => s.requestSearchFocus);
  /** The nav sheet is opening *for search* — its initial focus goes to the field, not the panel. */
  const searchIntent = useRef(false);
  const openSearch = useCallback(() => {
    if (window.matchMedia(DESKTOP_NAV_QUERY).matches) {
      setSidebarCollapsed(false);
      requestSearchFocus();
      return;
    }
    searchIntent.current = true;
    setMobileOpen(true);
    requestSearchFocus();
  }, [setSidebarCollapsed, requestSearchFocus]);

  // A keyboard shortcut to the one search box (UX audit 2026-10-16, SHELL-11). "/" only when the
  // keypress isn't typing into something; neither fires under an open dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const combo =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      const slash =
        e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target);
      if (!combo && !slash) return;
      if (modalOpen()) return;
      e.preventDefault();
      openSearch();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  /* ── Page actions on a phone: inline while they fit, folded into "⋯" when they don't ───────── */
  const headerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [actionsFolded, setActionsFolded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [hasActions, setHasActions] = useState(false);
  // Bumped whenever the slot's contents or the viewport change: unfold, and measure again.
  const [measure, remeasure] = useReducer((n: number) => n + 1, 0);
  const needsMeasure = useRef(true);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const bump = () => {
      needsMeasure.current = true;
      remeasure();
    };
    const mo = new MutationObserver(bump);
    mo.observe(slot, { childList: true, subtree: true });
    window.addEventListener("resize", bump);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", bump);
    };
  }, []);

  // A new page brings its own actions; the old fold state and an open panel mean nothing to it.
  useEffect(() => {
    setActionsOpen(false);
    needsMeasure.current = true;
    remeasure();
  }, [pathname]);

  /**
   * Measured, not counted. Several pages already shrink their own actions on a phone (Notifications'
   * "⋯", Projects hiding labelled buttons), and a running timer chip is wider than an idle one — so
   * the honest test is "does the row fit?". Unfold, lay out, and fold if the controls row no longer
   * fits on one line. A layout effect, so the trial layout is never painted.
   */
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    setHasActions(slot.childElementCount > 0);
    if (!needsMeasure.current) return;
    if (actionsFolded) {
      setActionsFolded(false); // lay out inline first; this effect runs again on that commit
      return;
    }
    needsMeasure.current = false;
    if (!window.matchMedia(PHONE_QUERY).matches || slot.childElementCount === 0) return;
    const header = headerRef.current;
    const right = rightRef.current;
    const menuBtn = menuBtnRef.current;
    if (!header || !right || !menuBtn) return;
    const wrapped = Math.abs(right.offsetTop - menuBtn.offsetTop) > 4;
    const overflows =
      right.scrollWidth > right.clientWidth + 1 || header.scrollWidth > header.clientWidth + 1;
    if (wrapped || overflows) setActionsFolded(true);
  }, [measure, actionsFolded]);

  // The folded panel closes on Escape, on a press outside it, and once one of its actions runs —
  // but not when the press opens a menu or select of its own (that popup is anchored to its trigger).
  useEffect(() => {
    if (!actionsOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (slotRef.current?.contains(t) || moreRef.current?.contains(t)) return;
      // A popup opened from inside the panel renders in a portal; pressing in it is not "outside".
      if ((t as Element).closest?.("[data-slot$='-content'], [role='listbox'], [role='menu']")) return;
      setActionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setActionsOpen(false);
      moreRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionsOpen]);

  const onSlotClick = (e: React.MouseEvent) => {
    if (!actionsFolded || !actionsOpen) return;
    const el = (e.target as Element).closest("button, a");
    if (!el || el.matches("[aria-haspopup], [aria-expanded]")) return;
    setActionsOpen(false);
  };

  return (
    // Below `sm` the bar wraps and the page title takes a row of its own (see the title block
    // below): on a 390 px phone the controls left it 3–11 px — "L", "Tim…", or nothing at all
    // beside a running timer (UX audit 2026-10-16, EMP-05 / XC-04). `sm` and up are unchanged.
    <header
      ref={headerRef}
      className="bg-background/85 sticky top-0 z-30 flex min-h-20 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 backdrop-blur-md sm:h-20 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0"
    >
      {/* Mobile sidebar trigger */}
      <Sheet
        open={mobileOpen}
        onOpenChange={(next) => {
          setMobileOpen(next);
          if (!next) searchIntent.current = false;
        }}
      >
        <SheetTrigger
          render={
            <Button
              ref={menuBtnRef}
              variant="ghost"
              size="icon"
              className="bg-card shadow-soft hover:bg-card size-10 rounded-full lg:hidden"
              aria-label="Open menu"
              // Where a tour's sidebar steps point below `lg`, where the sidebar itself is hidden.
              data-tour="nav:menu"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-0 bg-transparent p-3"
          data-nav-sheet=""
          // Opened by the search button or shortcut: land in the search field, not on the panel.
          initialFocus={() => {
            if (!searchIntent.current) return true;
            return (
              document.querySelector<HTMLElement>("[data-nav-sheet] [data-search-input]") ?? true
            );
          }}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      {/* Search, one tap away where the sidebar is hidden — it lived only inside the menu sheet
          (UX audit 2026-10-16, SHELL-11). Opens the sheet straight onto the field. */}
      <Button
        variant="ghost"
        size="icon"
        className="bg-card shadow-soft hover:bg-card size-10 rounded-full lg:hidden"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K /"
        onClick={openSearch}
      >
        <Search className="size-[18px]" />
      </Button>

      {/* Active page title with its subtitle beneath it; the whole block is
          vertically centered in the bar, level with the right-hand controls. */}
      {title ? (
        // `data-tour` anchor for the guided walkthroughs. This is the one element present on every
        // route for every role, so it's the reliable "you are here" target — unlike the dashboard's
        // GreetingHeader, which publishes into this store and renders only an sr-only heading.
        <div
          className="order-last min-w-0 basis-full sm:order-none sm:basis-auto"
          data-tour="page:header"
        >
          {/* A size smaller on a phone: the bar is sticky, and with the subtitle now shown there
              every pixel of its height is taken from the page. */}
          <span className="font-display block truncate text-xl leading-tight font-semibold tracking-tight sm:text-3xl">
            {title}
          </span>
          {/* On a phone the subtitle — the dashboard's date among them — was hidden outright
              (UX audit SHELL-06). It shows there now, smaller and up to two lines. */}
          {description ? (
            <span className="text-muted-foreground mt-0.5 line-clamp-2 text-sm leading-snug sm:block sm:truncate sm:text-base sm:leading-tight">
              {description}
            </span>
          ) : null}
        </div>
      ) : null}

      <div ref={rightRef} className="relative ml-auto flex min-w-0 items-center gap-2 sm:gap-2.5">
        {/* Below `sm`, when the page's actions don't fit beside the controls they fold behind this
            button into a small panel under it (UX audit 2026-10-16, XC-04 / SHELL-06). */}
        {actionsFolded && hasActions ? (
          <Button
            ref={moreRef}
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label="Page actions"
            aria-expanded={actionsOpen}
            aria-controls="wp-page-actions"
            onClick={() => setActionsOpen((o) => !o)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        ) : null}
        {/* Page actions (e.g. the Time Tracking My time/Team toggle) portal in
            here, on the same row as the title. The element is permanent — pages portal into it by
            id — so folding restyles it rather than moving it. */}
        <div
          ref={slotRef}
          id="wp-page-actions"
          onClick={onSlotClick}
          className={cn(
            "flex items-center gap-2 empty:hidden",
            actionsFolded &&
              "bg-popover shadow-soft absolute top-full right-0 z-40 mt-2 min-w-44 flex-col items-stretch rounded-xl border p-2",
            actionsFolded && !actionsOpen && "hidden",
          )}
        />
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
            page is not). Hidden on the download page itself — and in `machine`
            mode, where IT deploys the managed service and nobody self-installs
            (MANAGED-AGENT.md §8). Deliberately NOT feature-gated: the agent is
            core, never plan-gated. Not on a phone either: a desktop installer can't be used there,
            and the chip was crowding the bar (with a pulsing dot — EMP-09). */}
        {showDownloadChip ? (
          <Button
            render={<Link href="/download" />}
            nativeButton={false}
            size="sm"
            // `relative` anchors the dot; `overflow-visible` because the pill's rounded-full clips
            // the badge that sits proud of its top-right corner.
            className="shadow-soft relative hidden shrink-0 gap-1.5 overflow-visible rounded-full sm:inline-flex"
            // Acknowledging on click, not on arrival at /download, is deliberate: the click is the
            // moment the user has actually seen the announcement. Tying it to the destination would
            // also dismiss it for anyone who reaches the page by any other route, and would leave the
            // dot up for someone who clicked but never finished navigating.
            onClick={acknowledgeAgentRelease}
            aria-label={
              showUpdateCue
                ? `Update the desktop agent — version ${agentVersion} is available`
                : appBehind
                  ? "Update the desktop agent"
                  : "Download agent"
            }
          >
            <Download className="size-4" />
            <span>{appBehind ? "Update agent" : "Download agent"}</span>
            {showUpdateCue ? (
              <>
                {/* The version rides the button on wide screens — "something is new" is a weaker
                    message than "0.1.7 is out", and it costs no extra row. */}
                <span className="bg-primary-foreground/20 ml-0.5 hidden rounded-full px-1.5 py-px text-[0.65rem] font-semibold tabular-nums lg:inline">
                  v{agentVersion}
                </span>
                {/* Below lg the label has no room, so the state degrades to a dot rather than
                    disappearing. Steady, not pulsing: an update the app installs itself is news,
                    not an alarm. `aria-hidden` — the accessible name above already says it. */}
                <span
                  aria-hidden
                  className="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 lg:hidden"
                />
              </>
            ) : null}
          </Button>
        ) : null}
        {/* The running-session timer lives in the navbar everywhere EXCEPT the
            personal dashboard, which promotes it to a hero KPI tile (see TimerStatCard)
            — so it isn't shown twice. Only there: the org dashboard has no timer tile,
            and hiding the chip on it left an org-scoped contributor no timer at all
            (QA audit 2026-10-08, WP-437). */}
        {pathname !== "/dashboard" || !personalDashboard ? <GlobalTimer /> : null}
        <div className="bg-card shadow-soft flex shrink-0 items-center gap-0.5 rounded-full p-1">
          {/* The assistant docks here on a phone instead of floating over the page (XC-03). */}
          <AssistantTopBarButton />
          <NotificationsMenu />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
