"use client";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { PageHeader } from "@/components/shared/page-header";
import { GreetingHeader } from "./greeting-header";
import { PersonalDashboard } from "./personal-dashboard";
import { RealDashboard } from "./real-dashboard";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { useDashboardSummary } from "../use-dashboard-summary";

export function DashboardView() {
  // Self-scoped roles (Employee) get a personal dashboard, never org aggregates.
  const personal = useIsPersonalDashboard();

  if (personal) {
    return (
      <div className="space-y-4 pt-1">
        <GreetingHeader />
        <PersonalDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <GreetingHeader />
      <OrgDashboard />
    </div>
  );
}

/** The org (admin/owner/lead) view — real backend aggregates via {@link useDashboardSummary}. */
function OrgDashboard() {
  const { summary, loading, error, reload } = useDashboardSummary();

  if (loading && !summary) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading dashboard…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Dashboard" description="Your organization at a glance." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return summary ? <RealDashboard summary={summary} /> : null;
}
