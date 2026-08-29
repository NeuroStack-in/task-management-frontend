"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Loader } from "@/components/shared/loader";
import { OnboardingWizard } from "./onboarding-wizard";
import { OnboardingProvision } from "./onboarding-provision";
import { OrgRequestLoading, OrgRequestStatus } from "./org-request-status";
import { getMyOrgRequest, type MyOrgRequest } from "../services/onboarding.service";

/**
 * Guards the standalone /onboarding route. It's reached right after sign-up (the
 * OrgSetupModal logs the new member in, then hands off here), so it must not be
 * publicly viewable: wait for the persisted auth store to hydrate, then bounce
 * unauthenticated visitors to /login. Kept out of the (app) group on purpose so
 * onboarding stays full-screen, without the dashboard shell.
 */
export function OnboardingExperience() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A signed-in user with no organization yet (the "Continue with Google" self-signup) creates one
  // here first; a user who already has an org continues to the setup wizard.
  const hasOrg = useAuthStore((s) => Boolean(s.user?.organizationId));

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent("/onboarding")}`);
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader label="Loading…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
      </Link>
      {hasOrg ? <OnboardingWizard /> : <NoOrgFlow />}
    </div>
  );
}

/**
 * The org-less branch: ask, wait, or come back to a decision.
 *
 * Org creation is reviewed by WorkPulse staff, so "no org" is no longer one state — it is three,
 * and which one the applicant is in can only be answered by the server. Rendering the form before
 * that answer arrives is what would let someone submit twice.
 *
 *   no request  → the form
 *   pending     → the waiting screen
 *   decided     → approved (refresh + enter) or rejected (reason + reapply)
 */
function NoOrgFlow() {
  const [request, setRequest] = useState<MyOrgRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getMyOrgRequest()
      .then((r) => setRequest(r))
      // A failed lookup falls through to the form rather than blocking: the server rejects a second
      // request with `request_already_open`, so the worst case is a clear error, not a duplicate.
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <OrgRequestLoading />;
  if (request) {
    // Re-applying clears the local view and shows the form again; the server released the
    // one-per-email claim when it rejected, so a new submission is accepted.
    return <OrgRequestStatus request={request} onReapply={() => setRequest(null)} />;
  }
  return <OnboardingProvision onSubmitted={load} />;
}
