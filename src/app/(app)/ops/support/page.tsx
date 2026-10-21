"use client";

import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import { OpsSupportConsole } from "@/modules/ops/components/ops-support-console";
import { Loader } from "@/components/shared/loader";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Platform-ops support desk. Reachable by URL for any signed-in user, but self-guarded: the console
 * only renders for accounts on the server-side platform-admin allowlist. The backend is the real
 * gate — every ops API refuses a non-operator regardless of what the page shows.
 */
export default function Page() {
  const { isAdmin, loading, failed, retry } = usePlatformAdmin();
  // The guard states keep the page's one <h1> (and its top-bar title): they rendered an empty state
  // whose heading is an <h3>, so the page had no H1 at all (UX audit 2026-10-16, XC-10).
  const heading = <PageHeader title="Support desk" />;

  if (loading) {
    return (
      <>
        {heading}
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Checking access…" />
        </div>
      </>
    );
  }

  // A failed check is not a "no" — it used to read "Not authorized", with no way to ask again.
  if (failed) {
    return (
      <>
      {heading}
      <EmptyState
        icon={ShieldOff}
        title="Couldn't check your access"
        description="Something went wrong confirming you're on the WorkPulse support team. Try again in a moment."
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        }
      />
      </>
    );
  }

  // A way back (UX audit 2026-10-16, SET-25): the wall ended the page with nothing to press.
  if (!isAdmin) {
    return (
      <>
        {heading}
        <EmptyState
          icon={ShieldOff}
          title="This page is for WorkPulse staff"
          description="Only the WorkPulse support team can open it."
          action={
            <Button size="sm" render={<Link href="/dashboard" />} nativeButton={false}>
              <ArrowLeft className="size-4" /> Back to dashboard
            </Button>
          }
        />
      </>
    );
  }

  return <OpsSupportConsole />;
}
