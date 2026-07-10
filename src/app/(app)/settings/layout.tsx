"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Lock } from "lucide-react";
import { ACCOUNT_SECTIONS, ADMIN_SECTIONS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { InPaneHeaderContext } from "@/components/shared/page-header";
import { usePageTitle } from "@/stores/page-header.store";
import { cn } from "@/lib/utils";

interface RailItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Navigates to a full standalone page outside the settings shell. */
  external?: boolean;
}

interface RailGroup {
  label: string;
  items: RailItem[];
}

/**
 * Personal account sections, rendered in-pane. Sourced from the shared catalog
 * (kept in sync with global search). Billing shows only for roles that can view
 * billing (Owner/Admin/Finance). The personal "Security" entry (after Profile)
 * shows for roles WITHOUT the org Security Center — Owner/Admin reach security
 * there instead.
 */
function accountGroup(opts: {
  canBilling: boolean;
  canSecurity: boolean;
}): RailGroup {
  const items: RailItem[] = [];
  for (const it of ACCOUNT_SECTIONS) {
    // Billing is org-level — only roles that can view billing get it.
    if (it.href === "/settings/billing" && !opts.canBilling) continue;
    items.push({ label: it.label, href: it.href, icon: it.icon });
    // Personal login & security sits after Profile for roles WITHOUT the org
    // Security Center (Owner/Admin reach security there instead).
    if (it.href === "/settings/profile" && !opts.canSecurity) {
      items.push({
        label: "Security",
        href: "/settings/login-security",
        icon: Lock,
      });
    }
  }
  return { label: "Account", items };
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = usePermissions();

  // The navbar stays pinned to "Settings" across every sub-section; each
  // sub-page renders its own title/subtitle in-pane (via InPaneHeaderContext).
  usePageTitle("Settings", "Manage your account, organization, and access.");

  // Admin/config groups come from the shared constants and stay
  // permission-filtered. Items under /settings/* render in-pane; the rest
  // (Roles, Security, Audit Logs, Integrations, …) are full standalone pages
  // the rail links out to.
  const adminGroups: RailGroup[] = ADMIN_SECTIONS.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => can(item.permission))
      .map((item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        external: !item.href.startsWith("/settings"),
      })),
  })).filter((group) => group.items.length > 0);

  const groups: RailGroup[] = [
    accountGroup({
      canBilling: can("billing:view"),
      canSecurity: can("security:view"),
    }),
    ...adminGroups,
  ];

  return (
    // The rail sits in the shell's 24px (sm:px-6) gutter on its left, so the gap
    // on its right matches — otherwise the content pane reads as pushed off-centre.
    <div className="flex flex-col gap-6 pt-1 lg:h-[calc(100vh-7rem)] lg:flex-row lg:gap-6">
      {/* ── Section rail ── */}
      <nav
        aria-label="Settings sections"
        className="lg:h-full lg:w-60 lg:shrink-0"
      >
        <div className="wp-rail-scroll flex gap-5 overflow-x-auto pb-1 lg:h-full lg:min-h-0 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1.5">
          {groups.map((group) => (
            <div key={group.label} className="shrink-0 space-y-1.5">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </p>
              <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    !item.external &&
                    (pathname === item.href ||
                      pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "border-l-2 border-primary bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            !active && "group-hover:text-foreground",
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.external && (
                          <ArrowUpRight className="size-3.5 shrink-0 opacity-50" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* ── Content pane ── */}
      {/* Sub-pages render their header in-pane; the navbar shows "Settings". */}
      <InPaneHeaderContext.Provider value={true}>
        <div className="min-w-0 flex-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {children}
        </div>
      </InPaneHeaderContext.Provider>
    </div>
  );
}
