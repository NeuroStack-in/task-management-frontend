"use client";

import Link from "next/link";
import { ArrowLeft, ShieldOff } from "lucide-react";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import { OrgRequestsQueue } from "@/modules/ops/components/org-requests-queue";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Organization-creation review queue. Same shape and same guard as the support desk beside it:
 * reachable by URL for any signed-in user, but self-guarded, and the backend refuses a non-operator
 * regardless of what this page renders.
 *
 * Approving on this page is what creates an organization — until an operator does, no tenant exists.
 */
export default function Page() {
  const { isAdmin, loading, failed, retry } = usePlatformAdmin();
  // The guard states keep the page's one <h1> (and its top-bar title): they rendered an empty state
  // whose heading is an <h3>, so the page had no H1 at all (UX audit 2026-10-16, XC-10).
  const heading = <PageHeader title="Organization requests" />;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization requests"
        description="Review who is asking to create an organization. Approving creates it; until then nothing exists."
      />
      <OrgRequestsQueue />
    </div>
  );
}
