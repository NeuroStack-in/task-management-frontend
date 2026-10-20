"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Mail } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { resolveRole } from "@/hooks/use-permissions";
import { canAccess } from "@/lib/rbac";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { OnboardingWizard } from "./onboarding-wizard";
import { SignupExperience } from "@/modules/auth/components/signup-experience";
import { OrgRequestLoading, OrgRequestStatus } from "./org-request-status";
import {
  getMyInvites,
  getMyOrgRequest,
  resendMyInvite,
  type MyInvite,
  type MyOrgRequest,
} from "../services/onboarding.service";

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
  const [invites, setInvites] = useState<MyInvite[]>([]);
  /** They were invited but would rather create their own organisation. */
  const [createOwn, setCreateOwn] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getMyOrgRequest()
        // A failed lookup falls through to the form rather than blocking: the server rejects a
        // second request with `request_already_open`, so the worst case is a clear error.
        .catch(() => null),
      // Best-effort: without it the screen behaves as it always did.
      getMyInvites().catch(() => [] as MyInvite[]),
    ])
      .then(([r, inv]) => {
        setRequest(r);
        setInvites(inv);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  if (loading) return <OrgRequestLoading />;
  // Invited, but signed in with Google before opening the invite email: they have no organisation
  // yet, and this screen used to offer them a new one (UX audit ONB-03). The invite is the way in.
  if (!request && invites.length && !createOwn) {
    return <PendingInvites invites={invites} onCreateOwn={() => setCreateOwn(true)} />;
  }
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

/**
 * "You've been invited to Acme" — for someone who signed in before opening their invite email
 * (UX audit ONB-03). Accepting needs the link and code from that email, so this sends it again to
 * their own address rather than pretending they can join from here.
 */
function PendingInvites({
  invites,
  onCreateOwn,
}: {
  invites: MyInvite[];
  onCreateOwn: () => void;
}) {
  const email = useAuthStore((s) => s.user?.email ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());

  async function resend(inv: MyInvite) {
    setBusy(inv.invite_id);
    try {
      const r = await resendMyInvite(inv.tenant_id, inv.invite_id);
      setSent((s) => new Set(s).add(inv.invite_id));
      toast.success("Invite sent again", {
        description: `Check ${r.sent_to} for a new email with your link and code. The old ones no longer work.`,
      });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(
        code === "resent_recently"
          ? "It was sent less than a minute ago — check your inbox (and spam) first."
          : e instanceof ApiError && e.status === 404
            ? "That invite is no longer open. Ask your organisation for a new one."
            : friendlyError(e, "Couldn't send the invite again."),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-card shadow-soft w-full max-w-md space-y-5 rounded-2xl border p-8">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Mail className="text-primary size-6" />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            {invites.length === 1
              ? `You've been invited to ${invites[0].org_name || "an organisation"}`
              : "You've been invited"}
          </h1>
          <p className="text-muted-foreground text-sm">
            To join, open the invite email we sent{email ? ` to ${email}` : ""} and use its link
            and code. You don&apos;t need to create a workspace.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li
            key={inv.invite_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{inv.org_name || "An organisation"}</p>
              <p className="text-muted-foreground text-xs">
                {inv.locked
                  ? "Locked after too many wrong codes — sending it again unlocks it."
                  : `Expires ${new Date(inv.expires_at * 1000).toLocaleDateString([], { day: "numeric", month: "short" })}`}
              </p>
            </div>
            <Button
              size="sm"
              variant={sent.has(inv.invite_id) ? "ghost" : "outline"}
              disabled={busy === inv.invite_id}
              onClick={() => void resend(inv)}
            >
              {sent.has(inv.invite_id) ? "Sent — send again" : "Email me the invite again"}
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Not what you expected?{" "}
        <button type="button" className="text-foreground underline underline-offset-2" onClick={onCreateOwn}>
          Create your own workspace instead
        </button>
      </p>
    </div>
  );
}
