"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What a route shows when the viewer can't use it: no permission, not in the plan, switched off, or
 * outside the org's tracking mode (UX audit XC-02 / SHELL-01).
 *
 * It renders **inside** the app shell, so the sidebar, top bar and running timer stay put, and it
 * carries the page's `<h1>`. The body says what is missing and who can change it; `actions` holds the
 * way on. "Go to Dashboard" is always offered last, as the quiet option.
 */
export function AccessWall({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  /** What's missing and who can change it. */
  children: React.ReactNode;
  /** The fix, when the viewer can make it themselves (e.g. "View plans"). */
  action?: { label: string; href: string };
}) {
  return (
    <section
      aria-labelledby="access-wall-title"
      className="flex min-h-[60vh] items-center justify-center p-6"
    >
      <div className="border-border flex max-w-md flex-col items-center rounded-lg border p-8 text-center">
        <div className="bg-muted mb-4 flex size-10 items-center justify-center rounded-md">
          <Icon className="text-muted-foreground size-5" />
        </div>
        <h1 id="access-wall-title" className="text-lg font-semibold">
          {title}
        </h1>
        <div className="text-muted-foreground mt-2 space-y-2 text-sm">{children}</div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {action ? (
            <Button render={<Link href={action.href} />} nativeButton={false}>
              {action.label}
            </Button>
          ) : null}
          <Button
            variant="outline"
            render={<Link href="/dashboard" />}
            nativeButton={false}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </section>
  );
}
