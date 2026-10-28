"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LifeBuoy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Support desk", href: "/ops/support", icon: LifeBuoy },
  // Approving a request is what creates an organization.
  { label: "Org requests", href: "/ops/org-requests", icon: Building2 },
];

/**
 * The frame for a support operator who belongs to no organization (the `support@` login): the two
 * support pages, who is signed in, and Sign out.
 *
 * Not the customer shell: its sidebar, running timer, devices chip, bell and assistant all read one
 * organization's data, which the server refuses an org-less account (403 `org_required`). Such an
 * account used to land on "About your organization" instead (2026-10-28).
 */
export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const email = useAuthStore((s) => s.user?.email ?? "");
  const logout = useAuthStore((s) => s.logout);

  const signOut = () => {
    logout();
    // A full navigation, as the sidebar's Sign out does: it drops every in-memory store.
    window.location.replace("/login");
  };

  return (
    <div className="bg-background min-h-screen">
      <a
        href="#main-content"
        className="bg-card sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="font-display text-base font-semibold">WorkPulse support</span>
          <nav aria-label="Support" className="flex gap-1">
            {LINKS.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="text-muted-foreground hidden truncate text-sm sm:inline">{email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
