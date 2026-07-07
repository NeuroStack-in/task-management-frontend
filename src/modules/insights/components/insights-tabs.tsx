"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

/** Tab bar for the merged Insights page. Tabs are filtered by permission. */
export function InsightsTabs() {
  const pathname = usePathname();
  const { can } = usePermissions();
  const tabs = INSIGHTS_TABS.filter((t) => can(t.permission));

  if (tabs.length === 0) return null;

  // `overflow-x-auto` lets the tabs scroll horizontally on narrow screens, but it
  // also forces `overflow-y` to compute as `auto` (CSS spec) — and under display
  // scaling the row overflows vertically by 1px, popping a phantom scrollbar at the
  // right end. `wp-no-scrollbar` (globals.css) hides the scrollbar chrome; it must
  // be a real unlayered class because the app-wide `* { scrollbar-width: thin }`
  // beats any Tailwind utility. Horizontal scroll still works via swipe/drag.
  return (
    <div className="wp-no-scrollbar flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
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
  );
}
