"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { useAuthStore } from "@/stores/auth.store";
import { getMyOrgRequest, type MyOrgRequest } from "../services/onboarding.service";

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
  const router = useRouter();
  const refreshClaims = useAuthStore((s) => s.refreshClaims);
  const [current, setCurrent] = useState<MyOrgRequest>(request);
  const [entering, setEntering] = useState(false);

  // Poll while pending. Stops the moment it is decided — there is nothing further to learn, and a
  // decided request never changes again.
  useEffect(() => {
    if (current.status !== "pending") return;
    let live = true;
    const id = window.setInterval(() => {
      getMyOrgRequest()
        .then((r) => {
          if (live && r) setCurrent(r);
        })
        .catch(() => {
          // A failed check is not worth surfacing: the next one is 30s away and the screen is
          // already telling the truth.
        });
    }, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [current.status]);

  // Approved: mint a token that knows about the org, then enter. Runs on arrival as well as on a
  // poll that flips the status, because the applicant is usually away when the decision lands and
  // comes back to an already-approved request.
  const enter = useCallback(async () => {
    setEntering(true);
    try {
      await refreshClaims();
      router.replace("/dashboard");
    } catch {
      setEntering(false);
    }
  }, [refreshClaims, router]);

  useEffect(() => {
    if (current.status === "approved") void enter();
  }, [current.status, enter]);

  if (current.status === "approved") {
    return (
      <Card
        icon={<CheckCircle2 className="text-success size-6" />}
        title={`${current.org_name} is ready`}
        body="Your organization has been approved. Setting up your workspace…"
      >
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {entering ? <Loader2 className="size-4 animate-spin" /> : null}
          Signing you in
        </div>
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
      body={`A member of the WorkPulse team is reviewing your request for ${current.org_name}. We'll email you as soon as it's decided.`}
    >
      <p className="text-muted-foreground text-xs">
        You can close this page — nothing is lost. Sign in again any time to check.
      </p>
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
