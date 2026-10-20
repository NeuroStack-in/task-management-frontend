"use client";

/**
 * The admin Leave page's way to the requests themselves (UX audit 2026-10-16, TIME-17).
 *
 * The page showed the type catalog and every balance, but no request and no route to them — an
 * owner who came to "Leave" to approve someone's time off found nothing to approve. Requests are
 * decided in Approvals (reason, documents, the balance they'd leave, who else is off), so this links
 * there with the waiting count rather than cloning the queue onto a second page.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { countPendingLeave } from "@/modules/approvals/services/approvals.service";

type Count = { count: number; more: boolean } | "loading" | "error";

export function PendingRequestsLink() {
  const { can } = usePermissions();
  // The Approvals route's own gate. Without it the link would open an access wall.
  const canOpen = can("approvals:view");
  const [pending, setPending] = useState<Count>("loading");

  useEffect(() => {
    if (!canOpen) return;
    let live = true;
    countPendingLeave().then(
      (r) => live && setPending(r),
      () => live && setPending("error"),
    );
    return () => {
      live = false;
    };
  }, [canOpen]);

  const headline = !canOpen
    ? "Leave requests are decided in Approvals"
    : pending === "loading"
      ? "Checking for requests waiting for a decision…"
      : pending === "error"
        ? "Leave requests are decided in Approvals"
        : pending.count === 0
          ? "No leave requests are waiting for a decision"
          : `${pending.count}${pending.more ? "+" : ""} leave request${
              pending.count === 1 && !pending.more ? " is" : "s are"
            } waiting for a decision`;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="bg-feature-tint text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
          <Inbox className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="font-medium" role="status">
            {headline}
          </p>
          <p className="text-muted-foreground text-sm">
            {canOpen
              ? "Each request — with its reason, documents and the balance it would leave — is approved or rejected in Approvals."
              : "Someone whose role can approve leave decides them there."}
          </p>
        </div>
      </div>
      {canOpen ? (
        // A real link (it navigates), styled as a button.
        <Link
          href="/approvals"
          className={cn(
            buttonVariants({
              variant: typeof pending === "object" && pending.count > 0 ? "default" : "outline",
            }),
            "shrink-0",
          )}
        >
          Open Approvals
          {typeof pending === "object" && pending.count > 0 ? (
            <span className="bg-primary-foreground/20 rounded-full px-1.5 text-xs tabular-nums">
              {pending.count}
              {pending.more ? "+" : ""}
            </span>
          ) : null}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </Card>
  );
}
