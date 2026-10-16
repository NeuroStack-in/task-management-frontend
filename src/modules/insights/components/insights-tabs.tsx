"use client";

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
import { EMP_PARAM, withEmp } from "../lib/employee-scope";

/**
 * Tab bar for the merged Insights page. Filtered by **permission, entitlement/mode AND page
 * visibility** — a tab whose feature the org switched off (or whose route its tracking mode hides)
 * previously still rendered and then 403'd when clicked (`isNavItemVisible` resolves its feature via
 * `ROUTE_FEATURES`), and a tab the org had hidden in Settings → Features stayed in the bar and led to
 * "This page is turned off" (QA audit 2026-10-08, WP-326). Owners are exempt inside `isPageOn`.
 */
export function InsightsTabs() {
  const pathname = usePathname();
  // Carried across tabs, so a hub scoped to one employee stays on them (see `lib/employee-scope`).
  const emp = useSearchParams().get(EMP_PARAM);
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

  if (tabs.length === 0) return null;

  return (
    /* The border lives on the outer div and the scroll container overlaps it
       by 1px (-mb-px), so the active tab's indicator covers the border without
       the tabs overflowing their own scroll container — a 1px vertical
       overflow inside an overflow-x-auto box spawns a stray scrollbar. */
    <div className="border-b">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={withEmp(tab.href, emp)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
