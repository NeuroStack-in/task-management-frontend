"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { resolveRole } from "@/hooks/use-permissions";
import { canAccess } from "@/lib/rbac";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { OnboardingWizard } from "./onboarding-wizard";
import { SignupExperience } from "@/modules/auth/components/signup-experience";
import { OrgRequestLoading, OrgRequestStatus } from "./org-request-status";
import { getMyOrgRequest, type MyOrgRequest } from "../services/onboarding.service";

/**
 * Guards the standalone /onboarding route. It's where a signed-in user with no organization lands
 * (the auth guard sends them here) to request one, so it must not be publicly viewable: wait for the
 * persisted auth store to hydrate, then bounce unauthenticated visitors to /login. Kept out of the
 * (app) group on purpose so onboarding stays full-screen, without the dashboard shell.
 */
export function OnboardingExperience() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A signed-in user with no organization yet (the "Continue with Google" self-signup) creates one
  // here first; a user who already has an org continues to the setup wizard.
  const hasOrg = useAuthStore((s) => Boolean(s.user?.organizationId));
  const logout = useAuthStore((s) => s.logout);
  // The wizard edits the org — its details, invites, the tracking policy — so it is for whoever
  // manages org settings. Anyone else with an org has nothing to set up: an Employee who typed the
  // URL got four steps of failing writes, one of them blaming the plan (QA audit 2026-10-08, WP-127).
  const user = useAuthStore((s) => s.user);
  const customRoles = useRolesStore((s) => s.customRoles);
  const canSetUp = canAccess(resolveRole(user, customRoles), "settings:manage");

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent("/onboarding")}`);
    } else if (hydrated && hasOrg && !canSetUp) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, hasOrg, canSetUp, router]);

  if (!hydrated || !isAuthenticated || (hasOrg && !canSetUp)) {
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
      {/* This page sits outside the app shell, so the sidebar's "Log out" is not here. Without this
          someone who signed in with the wrong Google account — or is waiting on a request — had no
          way to leave that account on this browser (QA audit 2026-10-08, WP-126). The auth guard's
          redirect to /login follows the sign-out. */}
      {!hasOrg ? (
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      ) : null}
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
  // The full signup wizard minus its account step — Google already established who they are, and
  // there is no password to set. Steps 2-5 run unchanged and end in a request for approval.
  //
  // Deliberately the same component the public flow uses rather than a second, smaller form: a
  // parallel "quick" version would drift from it, and the fields it skipped would be ones the org
  // simply never gets.
  return <SignupExperience authenticated onSubmitted={load} />;
}
