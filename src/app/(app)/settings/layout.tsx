"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Building2, ChevronsUpDown, Lock, Settings2 } from "lucide-react";
import { ACCOUNT_SECTIONS, ADMIN_SECTIONS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgName } from "@/hooks/use-org";
import { isNavItemVisible } from "@/lib/rbac";
import {
  useIsFeatureAllowed,
  useIsFeatureOn,
  useTrackingMode,
} from "@/hooks/use-features";
import { isPathModeHidden } from "@/constants/features";
import { InPaneHeaderContext } from "@/components/shared/page-header";
import { usePageTitle } from "@/stores/page-header.store";
import { useUnsavedStore } from "@/stores/unsaved.store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
 * (kept in sync with global search). The personal "Security" entry (after Profile)
 * shows for roles WITHOUT the org Security Center — Owner/Admin reach security
 * there instead. (Billing is org-level and lives in the admin groups, gated there.)
 */
function accountGroup(opts: { canSecurity: boolean }): RailGroup {
  const items: RailItem[] = [];
  for (const it of ACCOUNT_SECTIONS) {
    items.push({ label: it.label, href: it.href, icon: it.icon });
    // Personal security sits after Profile for roles WITHOUT the org Security Center. Owner/Admin
    // don't get a second entry — their own password + reset lives inside that centre instead, so
    // there is exactly one "Security" destination per role.
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

const isActive = (item: RailItem, pathname: string) =>
  !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`));

/**
 * The grouped section list — the desktop rail, and the phone picker's sheet. One renderer for both,
 * so the two can't drift into listing different sections.
 */
function RailList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: RailGroup[];
  pathname: string;
  /** The phone sheet closes on a pick; the rail has nothing to close. */
  onNavigate?: () => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item, pathname);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    // Leaving mid-edit (the natural move from a rail beside the pane) is
                    // confirmed by the link listener in the layout, like every other in-app link.
                    onClick={onNavigate}
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
    </>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // The visible pane publishes this via `useUnsavedGuard`. This layout is where leaving gets
  // confirmed, because every settings pane renders inside it.
  const dirty = useUnsavedStore((s) => s.dirty);
  const pendingHref = useUnsavedStore((s) => s.pendingHref);
  const requestLeave = useUnsavedStore((s) => s.requestLeave);
  const cancelLeave = useUnsavedStore((s) => s.cancelLeave);
  const clearUnsaved = useUnsavedStore((s) => s.clear);
  /** The phone section picker's sheet (SET-05). */
  const [sectionsOpen, setSectionsOpen] = useState(false);

  // While a draft is unsaved, any in-app link asks first — not just this rail. The sidebar, the
  // navbar and the account menu used to throw the draft away without a word (QA audit 2026-10-08,
  // WP-347). Capture phase on `document`, so the click is held before the link's own handler runs.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab or window keeps the draft
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (requestLeave(`${url.pathname}${url.search}${url.hash}`)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, requestLeave]);
  const { can, role } = usePermissions();
  // The rail must honour the same two gates as the sidebar: a feature the org switched off, or a
  // route its tracking mode hides, should not link into the "turned off" wall (a live bug when it
  // filtered on permission alone).
  const isFeatureOn = useIsFeatureOn();
  const isFeatureAllowed = useIsFeatureAllowed();
  const mode = useTrackingMode();
  // Names the Company rail item after the org itself; null until `GET /v1/org` lands.
  const orgName = useOrgName();

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
      .filter((item) =>
        isNavItemVisible(
          role,
          item,
          isFeatureOn,
          (href) => isPathModeHidden(href, mode),
          undefined,
          isFeatureAllowed,
        ),
      )
      .map((item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        external: !item.href.startsWith("/settings"),
      })),
  })).filter((group) => group.items.length > 0);

  // The read-only company reference — details, hours, holidays, policies.
  //
  // **Shown only to people who cannot edit the org.** Anyone with `settings:view` already has the
  // "Organization" group below, which is the same information with the controls attached; offering
  // both put two near-identical entries in one rail and made an admin choose between a page and its
  // read-only twin. The route stays reachable, it is just no longer advertised to them.
  //
  // For an employee this is the *only* settings surface carrying the policies and schedule an admin
  // publishes, which is why it is a group of its own rather than folded into "Account" — it is
  // org-level, not personal.
  const showCompany = !can("settings:view");
  const companyGroup: RailGroup = {
    // Labelled "Company" rather than "Organization" so the two never collide in the rail, and
    // because the item beneath carries the org's actual name.
    label: "Company",
    items: [
      {
        // The org's own name, not a generic "Overview" — this is the page about *your* company, and
        // naming it says so. `useOrgName` is the same per-tenant-cached read the sidebar header
        // uses, so it costs no extra request.
        //
        // Falls back to "Overview" rather than a blank or a skeleton: the name arrives a beat after
        // first paint, and a rail item that renders empty (or changes width mid-read) is worse than
        // one that starts generic and settles on the real name.
        label: orgName ?? "Overview",
        href: "/settings/company",
        icon: Building2,
      },
    ],
  };

  const groups: RailGroup[] = [
    accountGroup({ canSecurity: can("security:view") }),
    ...(showCompany ? [companyGroup] : []),
    ...adminGroups,
  ];

  // Where the reader is, for the phone picker's face: the item and the group it sits in.
  const currentGroup = groups.find((g) => g.items.some((it) => isActive(it, pathname)));
  const currentItem = currentGroup?.items.find((it) => isActive(it, pathname));
  const CurrentIcon = currentItem?.icon ?? Settings2;

  return (
    // The rail sits in the shell's 24px (sm:px-6) gutter on its left, so the gap
    // on its right matches — otherwise the content pane reads as pushed off-centre.
    <div className="flex flex-col gap-6 pt-1 lg:h-[calc(100vh-7rem)] lg:flex-row lg:gap-6">
      {/* ── Section picker, below `lg` (UX audit 2026-10-16, SET-05) ──
          The rail used to fold into one horizontal strip here: "Profile · Notification preferences
          · Ap…", with every admin group off-screen, no sign it scrolled, and the current section
          not scrolled into view. A button that names where you are opens the same grouped list as
          a sheet instead — every section visible at once, in its group. */}
      <div className="lg:hidden">
        <Sheet open={sectionsOpen} onOpenChange={setSectionsOpen}>
          <SheetTrigger
            className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={`Settings section: ${currentItem?.label ?? "choose a section"}. Change section`}
          >
            <CurrentIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {currentGroup?.label ?? "Settings"}
              </span>
              <span className="block truncate text-sm font-medium">
                {currentItem?.label ?? "Choose a section"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              Change
              <ChevronsUpDown className="size-4" aria-hidden />
            </span>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl p-0">
            <SheetHeader className="pb-2">
              <SheetTitle>Settings sections</SheetTitle>
            </SheetHeader>
            <nav
              aria-label="Settings sections"
              className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-3 pb-6"
            >
              <RailList
                groups={groups}
                pathname={pathname}
                onNavigate={() => setSectionsOpen(false)}
              />
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Section rail, `lg` and up ── */}
      <nav
        aria-label="Settings sections"
        className="hidden lg:block lg:h-full lg:w-60 lg:shrink-0"
      >
        <div className="wp-rail-scroll flex h-full min-h-0 flex-col gap-5 overflow-y-auto overflow-x-hidden pr-1.5">
          <RailList groups={groups} pathname={pathname} />
        </div>
      </nav>

      {/* ── Content pane ── */}
      {/* Discard confirmation for leaving while a pane holds unsaved edits. */}
      <Dialog open={!!pendingHref} onOpenChange={(o) => !o && cancelLeave()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have edits on this page that haven&apos;t been saved. Leaving now discards them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={cancelLeave}>
              Stay on this page
            </Button>
            <Button
              size="sm"
              className="border-destructive/40 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const href = pendingHref;
                // Clear before navigating: the outgoing pane's unmount would clear it anyway, but
                // not before the next pane mounts, and a stale `true` would block that one too.
                clearUnsaved();
                if (href) router.push(href);
              }}
            >
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-pages render their header in-pane; the navbar shows "Settings". */}
      <InPaneHeaderContext.Provider value={true}>
        <div className="min-w-0 flex-1 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {children}
        </div>
      </InPaneHeaderContext.Provider>
    </div>
  );
}
