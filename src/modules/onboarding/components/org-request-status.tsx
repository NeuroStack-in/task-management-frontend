"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { usePoll } from "@/hooks/use-poll";
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

/**
 * What the waiting screen promises (owner decision 2026-10-20, UX audit ONB-02). It said only "a
 * member of the team is reviewing", with no idea of when.
 */
export const REVIEW_TIME = "We usually review requests within one business day.";

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
        icon={<CheckCircle2 className="text-success size-6" />}
        title={`${current.org_name} is ready`}
        body="Your organization has been approved. Opening your workspace setup…"
      >
        {enterFailed ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              We couldn&apos;t finish signing you in. Check your connection and try again, or sign
              out and back in.
            </p>
            <Button onClick={() => void enter()} className="w-full">
              Try again
            </Button>
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            {entering ? <Loader2 className="size-4 animate-spin" /> : null}
            Signing you in
          </div>
        )}
      </Card>
    );
  }

  if (current.status === "rejected") {
    return (
      <Card
        icon={<XCircle className="text-destructive size-6" />}
        title="Request not approved"
        body={`We couldn't set up ${current.org_name}.`}
      >
        {/* The reason is the point of this screen. Without it the applicant has nothing to act on
            and no option but to ask a human — the support ticket this whole flow exists to avoid. */}
        {current.reason ? (
          <p className="bg-muted/50 text-foreground rounded-lg border px-3 py-2 text-sm">
            {current.reason}
          </p>
        ) : null}
        <Button onClick={onReapply} className="w-full">
          Submit a new request
        </Button>
      </Card>
    );
  }

  return (
    <Card
      icon={<Clock className="text-primary size-6" />}
      title="Request received"
      body={`A member of the WorkPulse team is reviewing your request for ${current.org_name}. ${REVIEW_TIME} We'll email you as soon as it's decided.`}
    >
      <p className="text-muted-foreground text-xs">
        You can close this page — nothing is lost. Sign in again any time to check.
      </p>
      {/* A typo in the organisation name, or the wrong size, used to be stuck until the review —
          withdrawing frees the request so a corrected one can go in (ONB-02). */}
      <Button variant="outline" className="w-full" onClick={() => setChanging(true)}>
        Change my request
      </Button>
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

/** The shared frame, so the three outcomes differ only in what they say. */
function Card({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card shadow-soft w-full max-w-md rounded-2xl border p-8">
      <div className="mb-5 flex items-start gap-3">
        <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-xl">
          {icon}
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{body}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** The loading frame, while we find out whether they have asked yet. */
export function OrgRequestLoading() {
  return (
    <div className="bg-card shadow-soft flex w-full max-w-md items-center justify-center rounded-2xl border p-12">
      <Loader label="Checking your request…" />
    </div>
  );
}
