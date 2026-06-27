"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Bell, Palette, User } from "lucide-react";
import { ADMIN_SECTIONS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
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

/** Personal account sections — always available, rendered in-pane. */
const ACCOUNT_GROUP: RailGroup = {
  label: "Account",
  items: [
    { label: "Profile", href: "/settings/profile", icon: User },
    { label: "Notifications", href: "/settings/notifications", icon: Bell },
    { label: "Appearance", href: "/settings/appearance", icon: Palette },
  ],
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { can } = usePermissions();

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

  const groups: RailGroup[] = [ACCOUNT_GROUP, ...adminGroups];

  return (
    <div className="flex flex-col gap-6 pt-1 lg:flex-row lg:gap-10">
      {/* ── Section rail ── */}
      <nav
        aria-label="Settings sections"
        className="lg:sticky lg:top-20 lg:w-60 lg:shrink-0 lg:self-start"
      >
        <p className="mb-4 hidden font-display text-lg font-semibold tracking-tight lg:block">
          Settings
        </p>
        <div className="wp-rail-scroll flex gap-5 overflow-x-auto pb-1 lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:gap-5 lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:pr-1.5">
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
                            ? "bg-primary text-primary-foreground shadow-sm"
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
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
