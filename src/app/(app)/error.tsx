"use client";

/**
 * The signed-in area's error boundary — **inside** the shell.
 *
 * The only boundary used to be the root one, above `AuthGuard` + `DashboardShell`, so one widget
 * throwing tore down the sidebar, the navbar and the open assistant chat, and "Try again" remounted
 * the whole shell (QA audit 2026-10-08, WP-118). Here the page area alone is replaced.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">This page didn&apos;t load properly</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Something went wrong on our side — your work is safe. Try again, or open another page from
        the menu.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
        <Button variant="outline" render={<Link href="/dashboard" />} nativeButton={false}>
          Back to dashboard
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
