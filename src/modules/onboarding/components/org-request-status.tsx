"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { usePoll } from "@/hooks/use-poll";
import { formatDate } from "@/lib/format";
import { AuthHeading } from "@/modules/auth/components/auth-frame";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  getMyOrgRequest,
  withdrawMyOrgRequest,
  type MyOrgRequest,
} from "../services/onboarding.service";
// What the waiting screen promises (owner decision 2026-10-20, UX audit ONB-02) — shared with the
// sign-up screens so they say the same sentence (PUB-03).
import { REVIEW_TIME } from "../review-time";

/** How often a waiting applicant re-checks. Slow: a human decision is minutes-to-days, not seconds. */
const POLL_MS = 30_000;

/**
 * What a signed-in user with **no organization** sees once they have asked for one.
 *
 * This screen exists because approval is asynchronous and the applicant is in an unusual state: they
 * hold a real, signed-in account with no tenant, so every authenticated surface in the product is
 * empty for them. Without somewhere to land they would be bounced back to the onboarding form they
 * already completed, and would reasonably submit again.
 *
 * Three outcomes, and the approved one is the awkward case: the org now exists but **their token
 * still says `perm=0`**, because it was minted before the tenant did. So approval is not a redirect
 * — it is a token refresh followed by a redirect, and the refresh has to happen here rather than at
 * the moment of approval, since the applicant is usually not watching when a decision lands.
 */
export function OrgRequestStatus({
  request,
  onReapply,
}: {
  request: MyOrgRequest;
  onReapply: () => void;
}) {
  const refreshClaims = useAuthStore((s) => s.refreshClaims);
  const [current, setCurrent] = useState<MyOrgRequest>(request);
  const [entering, setEntering] = useState(false);
  /** The approval hand-off's token refresh failed — offer a retry instead of spinning forever. */
  const [enterFailed, setEnterFailed] = useState(false);
  /** "Change my request": withdraw the pending one, then the form shows again (ONB-02). */
  const [changing, setChanging] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Poll while pending. Stops the moment it is decided — there is nothing further to learn, and a
  // decided request never changes again. Through the shared `usePoll`, so it pauses while the tab is
  // hidden and checks the moment it is shown again: a raw interval kept polling a backgrounded tab
  // every 30 s for as long as it stayed open (QA audit 2026-10-08, WP-391).
  const check = useCallback(() => {
    getMyOrgRequest()
      .then((r) => {
        if (r) setCurrent(r);
      })
      .catch(() => {
        // A failed check is not worth surfacing: the next one is 30s away and the screen is
        // already telling the truth.
      });
  }, []);
  usePoll(check, current.status === "pending" ? POLL_MS : null);

  // Approved: mint a token that knows about the org.
  //
  // **No redirect.** This screen already lives at /onboarding, whose parent renders the setup
  // wizard once `hasOrg` is true — so refreshing the claims is the whole handover, and the wizard
  // appears in place. Navigating to /dashboard here skipped it entirely: the org was created and
  // the owner was dropped into an empty product with none of the setup the wizard exists to do.
  //
  // Runs on arrival as well as on a poll that flips the status, because the applicant is usually
  // away when the decision lands and comes back to an already-approved request.
  const enter = useCallback(async () => {
    setEntering(true);
    setEnterFailed(false);
    let ok = false;
    try {
      // On success `hasOrg` flips in the auth store and the parent swaps this component for the
      // wizard, so `entering` stays true only until that unmount.
      ok = await refreshClaims();
    } catch {
      ok = false;
    }
    // A refresh that failed used to be silent: "Signing you in" spun forever with no way on
    // (QA audit 2026-10-08, WP-126).
    if (!ok) {
      setEntering(false);
      setEnterFailed(true);
    }
  }, [refreshClaims]);

  useEffect(() => {
    if (current.status === "approved") void enter();
  }, [current.status, enter]);

  if (current.status === "approved") {
    return (
      <Card
        icon={<CheckCircle2 className="size-5" />}
        title={`${current.org_name} is ready`}
        body="Your organization has been approved. Opening your workspace setup…"
      >
        {enterFailed ? (
          <>
            <p className="m-anote" role="alert">
              We couldn&apos;t finish signing you in. Check your connection and try again, or sign
              out and back in.
            </p>
            <button type="button" onClick={() => void enter()} className="m-btn m-btn-primary w-full">
              Try again
            </button>
          </>
        ) : (
          <p className="m-anote flex items-center gap-2" role="status">
            {entering ? <Loader2 className="m-spin size-4" aria-hidden="true" /> : null}
            Signing you in
          </p>
        )}
      </Card>
    );
  }

  if (current.status === "rejected") {
    return (
      <Card
        icon={<XCircle className="size-5" />}
        tone="bad"
        title="Request not approved"
        body={`We couldn't set up ${current.org_name}.`}
      >
        {/* The reason is the point of this screen. Without it the applicant has nothing to act on
            and no option but to ask a human — the support ticket this whole flow exists to avoid. */}
        {current.reason ? <p className="m-reqreason">{current.reason}</p> : null}
        <button type="button" onClick={onReapply} className="m-btn m-btn-primary w-full">
          Submit a new request
        </button>
      </Card>
    );
  }

  return (
    <Card
      icon={<Clock className="size-5" />}
      title="Request received"
      body={`A member of the WorkPulse team is reviewing your request for ${current.org_name}. ${REVIEW_TIME} We'll email you as soon as it's decided.`}
    >
      <p className="m-anote">
        Sent {formatDate(current.requested_at)}. You can close this page — nothing is lost. Sign in
        again any time to check.
      </p>
      {/* A typo in the organisation name, or the wrong size, used to be stuck until the review —
          withdrawing frees the request so a corrected one can go in (ONB-02). */}
      <button type="button" className="m-btn m-btn-ghost w-full" onClick={() => setChanging(true)}>
        Change my request
      </button>
      <ConfirmDialog
        open={changing}
        onOpenChange={(o) => !o && setChanging(false)}
        title="Change your request?"
        description={`Your request for ${current.org_name} is withdrawn and you fill the form in again. The new one joins the queue when you send it.`}
        confirmLabel="Withdraw and edit"
        busy={withdrawing}
        onConfirm={async () => {
          setWithdrawing(true);
          try {
            await withdrawMyOrgRequest();
            setChanging(false);
            onReapply();
          } catch (e) {
            const code = e instanceof ApiError ? e.code : undefined;
            toast.error(
              code === "approval_in_progress"
                ? "Your request is being approved right now, so it can't be changed. Check back in a few minutes."
                : e instanceof ApiError && e.status === 404
                  ? "This request was already decided — refresh the page."
                  : friendlyError(e, "Couldn't withdraw the request."),
            );
            setChanging(false);
            check();
          } finally {
            setWithdrawing(false);
          }
        }}
      />
    </Card>
  );
}

/**
 * The shared content, so the three outcomes differ only in what they say. It renders inside the
 * sign-up's auth card (`OnboardingExperience`) — it was a separate app card on a grey page, a
 * different product from the form the applicant had just filled in (UX audit ONB-13).
 */
function Card({
  icon,
  title,
  body,
  tone = "neutral",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "neutral" | "bad";
  children?: React.ReactNode;
}) {
  return (
    <>
      <span className={`m-reqicon${tone === "bad" ? " m-reqicon--bad" : ""}`} aria-hidden="true">
        {icon}
      </span>
      <AuthHeading title={title} subtitle={body} />
      <div className="grid gap-3">{children}</div>
    </>
  );
}
