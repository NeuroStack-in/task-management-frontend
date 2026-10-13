import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The branded 404 — any unknown URL, and every `notFound()`.
 *
 * Without it Next served its own white "404 | This page could not be found." with no branding and
 * no way back except the browser, for a stale bookmark or a typo under the signed-in area alike
 * (QA audit 2026-10-08, WP-118). Both links work signed in or out: the dashboard bounces a
 * signed-out visitor to sign-in.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-6" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        The link may be out of date, or the page may have moved. Head back to the dashboard and
        carry on from there.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/dashboard" />} nativeButton={false}>
          Back to dashboard
        </Button>
        <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
          WorkPulse home
        </Button>
      </div>
    </div>
  );
}
