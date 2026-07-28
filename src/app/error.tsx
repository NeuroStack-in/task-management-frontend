"use client";

/**
 * The App Router error boundary — what a user sees when a page throws while rendering.
 *
 * Without this file Next.js shows its own screen: a bare "Application error: a client-side exception
 * has occurred", plus the raw message and stack in development. That is the loudest raw error in the
 * product, and it appeared precisely when someone was already stuck.
 *
 * The `digest` is deliberately shown but played down. It is the only handle support has for finding
 * the matching server log, and it is an opaque hash — not a message, not a stack.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The details belong in the console for whoever is debugging, never on screen.
    console.error("Unhandled UI error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
        <AlertTriangle className="size-6" />
      </span>

      <h1 className="text-xl font-semibold tracking-tight">
        This page didn&apos;t load properly
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Something went wrong on our side — your work is safe. Try again, and if it
        keeps happening, head back to the dashboard or contact support.
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
        <p className="mt-6 font-mono text-xs text-muted-foreground/70">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
