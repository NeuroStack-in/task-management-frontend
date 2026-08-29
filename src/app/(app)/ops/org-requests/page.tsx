"use client";

import { ShieldOff } from "lucide-react";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import { OrgRequestsQueue } from "@/modules/ops/components/org-requests-queue";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * Organization-creation review queue. Same shape and same guard as the support desk beside it:
 * reachable by URL for any signed-in user, but self-guarded, and the backend refuses a non-operator
 * regardless of what this page renders.
 *
 * Approving on this page is what creates an organization — until an operator does, no tenant exists.
 */
export default function Page() {
  const { isAdmin, loading } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Checking access…" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Not authorized"
        description="This area is for WorkPulse platform-support operators only."
      />
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
