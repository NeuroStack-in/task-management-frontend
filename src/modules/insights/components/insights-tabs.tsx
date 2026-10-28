"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useIsFeatureAllowed,
  useIsFeatureOn,
  useIsPageOn,
  useTrackingMode,
} from "@/hooks/use-features";
import { isNavItemVisible } from "@/lib/rbac";
import { isPathModeHidden } from "@/constants/features";
import { cn } from "@/lib/utils";
import { withCarriedParams } from "../lib/url-params";

/**
 * Tab bar for the merged Insights page. Filtered by **permission, entitlement/mode AND page
 * visibility** — a tab whose feature the org switched off (or whose route its tracking mode hides)
 * previously still rendered and then 403'd when clicked (`isNavItemVisible` resolves its feature via
 * `ROUTE_FEATURES`), and a tab the org had hidden in Settings → Features stayed in the bar and led to
 * "This page is turned off" (QA audit 2026-10-08, WP-326). Owners are exempt inside `isPageOn`.
 *
 * **Carries the day, the department and the employee scope** from tab to tab (UX audit 2026-10-16,
 * MON-13): each link copies `?date=`, `?dept=` and `?emp=` from the current URL, so switching tabs
 * no longer drops the reader back on today and every department.
 *
 * **On a phone the tabs wrap** (AI audit 2026-10-22, AI-62). Four tabs don't fit 390 px. The bar
 * used to scroll sideways with a fade at the edge (MON-19), and the auditors still found "AI reports"
 * off-screen with only a sliver of its icon showing — a fade is easy to miss. Below `sm` the tabs now
 * wrap onto a second line, so every tab is in view. From `sm` up the bar scrolls if it ever needs to,
 * with the active tab scrolled into view and a fade on each edge that has more behind it.
 */
export function InsightsTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { role } = usePermissions();
  const isFeatureOn = useIsFeatureOn();
  const isFeatureAllowed = useIsFeatureAllowed();
  const isPageOn = useIsPageOn();
  const mode = useTrackingMode();
  // Plan-limited tabs stay visible (they open an Upgrade wall) — only tabs the org toggled off vanish.
  const tabs = INSIGHTS_TABS.filter((t) =>
    isNavItemVisible(
      role,
      t,
      isFeatureOn,
      (href) => isPathModeHidden(href, mode),
      isPageOn,
      isFeatureAllowed,
    ),
  );

  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  // Bring the active tab into view (on a phone it can start off-screen), then measure the edges.
  const tabCount = tabs.length;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      const a = active.offsetLeft;
      const b = a + active.offsetWidth;
      if (a < el.scrollLeft || b > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: Math.max(0, b - el.clientWidth + 16) });
      }
    }
    measure();
  }, [pathname, tabCount, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  if (tabs.length === 0) return null;

  return (
    /* The border lives on the outer div and the scroll container overlaps it
       by 1px (-mb-px), so the active tab's indicator covers the border without
       the tabs overflowing their own scroll container — a 1px vertical
       overflow inside an overflow-x-auto box spawns a stray scrollbar. */
    <nav aria-label="Analytics sections" className="relative border-b">
      <div
        ref={scroller}
        onScroll={measure}
        className="-mb-px flex flex-wrap gap-x-1 sm:flex-nowrap sm:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={withCarriedParams(tab.href, searchParams)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors sm:px-3",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {/* Scroll cues: a fade over each edge with tabs hidden behind it. Decorative — every tab is
          still a link in the tab order, so a keyboard or screen-reader user reaches it regardless. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
    </nav>
  );
}
