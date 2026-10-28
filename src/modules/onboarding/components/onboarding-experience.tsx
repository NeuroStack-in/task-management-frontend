"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";
import { useRolesStore } from "@/stores/roles.store";
import { resolveRole } from "@/hooks/use-permissions";
import { canAccess } from "@/lib/rbac";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import { getOrg } from "@/modules/settings/services/org.service";
import { AuthFrame, AuthHeading } from "@/modules/auth/components/auth-frame";
import { SignupExperience } from "@/modules/auth/components/signup-experience";
import { SIGNUP_PANEL } from "@/modules/auth/signup-panel";
import { OnboardingWizard } from "./onboarding-wizard";
import { OrgRequestStatus } from "./org-request-status";
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
 *
 * ## One frame for the whole route (UX audit 2026-10-16, ONB-13 / ONB-14)
 *
 * Every state renders in the sign-up's own split frame (`AuthFrame`): the request form, the waiting
 * screen, a pending invite and the owner's setup wizard. It used to drop the request form — itself a
 * full-screen split layout — inside a centred column under a second, hand-drawn logo, with "Sign
 * out" loose below the page; and the wizard was a grey app card that looked like another product.
 * "Signed in as … · Sign out" now sits at the foot of the card on every state. The route imports
 * the auth styles itself (`app/onboarding/page.tsx`), so a hard refresh keeps them.
 */
export function OnboardingExperience() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A signed-in user with no organization yet (the "Continue with Google" self-signup) creates one
  // here first; a user who already has an org continues to the setup wizard.
  const hasOrg = useAuthStore((s) => Boolean(s.user?.organizationId));
  // The wizard edits the org — its details, invites, the tracking policy — so it is for whoever
  // manages org settings. Anyone else with an org has nothing to set up: an Employee who typed the
  // URL got four steps of failing writes, one of them blaming the plan (QA audit 2026-10-08, WP-127).
  const user = useAuthStore((s) => s.user);
  const customRoles = useRolesStore((s) => s.customRoles);
  const canSetUp = canAccess(resolveRole(user, customRoles), "settings:manage");
  // A support operator created outside every organization has no org either, and was shown "About
  // your organization" (2026-10-28). Ask the allowlist before offering to create one.
  const orgless = hydrated && isAuthenticated && !hasOrg;
  const { isAdmin: isOperator, loading: operatorPending } = usePlatformAdmin(orgless);
  // An owner who already finished setup is sent on to the dashboard: reopening the "your
  // organization is ready" link put them through the wizard again (2026-10-28). `null` = still
  // asking; a failed read, or a server without the flag, shows the wizard as before.
  const wantsWizard = hydrated && isAuthenticated && hasOrg && canSetUp;
  const [setupFinished, setSetupFinished] = useState<boolean | null>(null);
  useEffect(() => {
    if (!wantsWizard) return;
    let live = true;
    getOrg().then(
      (org) => live && setSetupFinished(org.setup_finished === true),
      () => live && setSetupFinished(false),
    );
    return () => {
      live = false;
    };
  }, [wantsWizard]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent("/onboarding")}`);
    } else if (hydrated && hasOrg && !canSetUp) {
      router.replace("/dashboard");
    } else if (orgless && isOperator) {
      router.replace("/ops/support");
    } else if (wantsWizard && setupFinished) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, hasOrg, canSetUp, orgless, isOperator, wantsWizard, setupFinished, router]);

  if (
    !hydrated ||
    !isAuthenticated ||
    (hasOrg && !canSetUp) ||
    (orgless && (operatorPending || isOperator)) ||
    (wantsWizard && setupFinished !== false)
  ) {
    return (
      <AuthFrame {...SIGNUP_PANEL}>
        <FrameLoading label="Loading…" />
      </AuthFrame>
    );
  }

  if (hasOrg) {
    return (
      <AuthFrame
        headline="Your organization"
        headlineAccent="is ready"
        copy="Four quick steps: your organization, your team, tracking and your dashboard. Every choice can be changed later in Settings."
      >
        <OnboardingWizard />
        <SignedInAs />
      </AuthFrame>
    );
  }

  return <NoOrgFlow />;
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

  // The full signup wizard minus its account step — Google already established who they are, and
  // there is no password to set. The remaining steps run unchanged and end in a request for
  // approval.
  //
  // Deliberately the same component the public flow uses rather than a second, smaller form: a
  // parallel "quick" version would drift from it, and the fields it skipped would be ones the org
  // simply never gets. It brings its own frame; the sign-out goes in its card's footer.
  const showForm = !loading && !request && !(invites.length && !createOwn);
  if (showForm) {
    return <SignupExperience authenticated onSubmitted={load} footer={<SignedInAs />} />;
  }

  return (
    <AuthFrame {...SIGNUP_PANEL}>
      {loading ? (
        <FrameLoading label="Checking your request…" />
      ) : request ? (
        // Re-applying clears the local view and shows the form again; the server released the
        // one-per-email claim when it rejected, so a new submission is accepted.
        <OrgRequestStatus request={request} onReapply={() => setRequest(null)} />
      ) : (
        // Invited, but signed in with Google before opening the invite email: they have no
        // organisation yet, and this screen used to offer them a new one (UX audit ONB-03).
        <PendingInvites invites={invites} onCreateOwn={() => setCreateOwn(true)} />
      )}
      <SignedInAs />
    </AuthFrame>
  );
}

/**
 * "Signed in as … · Sign out", at the foot of the card (ONB-13). This page sits outside the app
 * shell, so the sidebar's "Sign out" is not here. Without this someone who signed in with the wrong
 * Google account — or is waiting on a request — had no way to leave that account on this browser
 * (QA audit 2026-10-08, WP-126). The guard's redirect to /login follows the sign-out.
 */
function SignedInAs() {
  const email = useAuthStore((s) => s.user?.email ?? "");
  const logout = useAuthStore((s) => s.logout);
  return (
    <p className="m-signedin">
      {email ? (
        <span>
          Signed in as <strong>{email}</strong>
        </span>
      ) : null}
      <button type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </p>
  );
}

function FrameLoading({ label }: { label: string }) {
  return (
    <p
      className="flex items-center justify-center gap-2 py-10 text-sm"
      style={{ color: "var(--m-muted)" }}
      role="status"
    >
      <Loader2 className="m-spin size-4" aria-hidden="true" />
      {label}
    </p>
  );
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
            ? "That invite is no longer open. Ask your organization for a new one."
            : friendlyError(e, "Couldn't send the invite again."),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AuthHeading
        title={
          invites.length === 1
            ? `You've been invited to ${invites[0].org_name || "an organisation"}`
            : "You've been invited"
        }
        subtitle={`To join, open the invite email we sent${email ? ` to ${email}` : ""} and use its link and code. You don't need to create a workspace.`}
      />
      <ul className="m-invitelist">
        {invites.map((inv) => (
          <li key={inv.invite_id}>
            <div className="min-w-0">
              <p className="m-invitelist__org">{inv.org_name || "An organisation"}</p>
              <p className="m-invitelist__meta">
                {inv.locked
                  ? "Locked after too many wrong codes — sending it again unlocks it."
                  : `Expires ${formatDate(inv.expires_at * 1000)}`}
              </p>
            </div>
            <button
              type="button"
              className="m-btn m-btn-ghost m-btn--sm"
              disabled={busy === inv.invite_id}
              onClick={() => void resend(inv)}
            >
              {sent.has(inv.invite_id) ? "Sent — send again" : "Email me the invite again"}
            </button>
          </li>
        ))}
      </ul>
      <p className="m-anote">
        Not what you expected?{" "}
        <button
          type="button"
          className="font-semibold underline underline-offset-2"
          style={{ color: "var(--m-accent-ink)" }}
          onClick={onCreateOwn}
        >
          Create your own workspace instead
        </button>
      </p>
    </>
  );
}
