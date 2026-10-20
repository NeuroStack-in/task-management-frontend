"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DocumentList } from "@/components/shared/document-list";
import { cn } from "@/lib/utils";
import type { ApiLeaveAttachment } from "@/modules/leave/services/leave.service";
import { formatWallClock } from "@/modules/attendance/lib/clock";


export interface LeaveDetail {
  /** Leave type — the dialog's title. */
  typeName: string;
  status: string;
  statusClass: string;
  /** "Submitted 29 Aug 2026". */
  submittedLabel: string;
  /** Shown only when the reader isn't the requester (the approver's view). */
  person?: { userId: string; name: string };
  /** "31 Aug 2026" or "19 – 21 Aug 2026" — `formatDate` / `formatDateRange`. */
  dateLabel: string;
  /** The figure: "1 day" / "2 h off". */
  valueLabel: string;
  /** `HH:MM` window for a few hours off (the API's `permission` kind), else null. */
  fromTime?: string;
  toTime?: string;
  reason?: string;
  /** The approver's note on a rejection — what the requester needs to act on (TIME-10). */
  decisionReason?: string;
  attachments: ApiLeaveAttachment[];
  resolveUrl: (documentId: string) => Promise<string>;
}

/**
 * One leave request, in full — shared by the approver's queue and the requester's own list.
 *
 * The two pages were built separately and drifted: the approver could open a request and read its
 * reason, window and documents, while the person who *wrote* it could only see a truncated row. The
 * information is the same in both places; only the footer differs, so that is the only thing either
 * caller passes in.
 */
export function LeaveDetailDialog({
  open,
  onOpenChange,
  detail,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: LeaveDetail | null;
  /** Approve/Reject, Withdraw, or a settled-status banner. */
  footer?: ReactNode;
}) {
  if (!detail) return null;
  const window =
    detail.fromTime && detail.toTime
      ? // The viewer's clock, not a forced "2:30 pm" (UX audit 2026-10-16, TIME-14).
        `${formatWallClock(detail.fromTime)} to ${formatWallClock(detail.toTime)}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail.typeName}
            <Badge className={cn("font-medium", detail.statusClass)}>{detail.status}</Badge>
          </DialogTitle>
          <DialogDescription>{detail.submittedLabel}</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 flex items-center gap-3 rounded-xl p-3">
          {detail.person ? (
            <UserAvatar
              userId={detail.person.userId}
              name={detail.person.name}
              className="size-10"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {detail.person ? (
              <p className="truncate font-medium">{detail.person.name}</p>
            ) : null}
            <p className="text-muted-foreground truncate text-sm">{detail.dateLabel}</p>
            {/* The one thing a few hours off is actually decided on: which hours the person is
                away. Not "Permission from …" — HR jargon (UX audit 2026-10-16, TIME-08). */}
            {window ? (
              <p className="text-foreground truncate text-sm">Away from {window}</p>
            ) : null}
          </div>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {detail.valueLabel}
          </span>
        </div>

        {detail.reason ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Reason
            </p>
            {/* `break-words` — a reason can be one unbroken run of characters, which otherwise
                widened the dialog past the viewport. */}
            <p className="text-sm leading-relaxed break-words">{detail.reason}</p>
          </div>
        ) : null}

        {detail.decisionReason ? (
          <div className="border-destructive/25 bg-destructive/[0.05] space-y-1.5 rounded-lg border p-3">
            <p className="text-destructive text-xs font-medium tracking-wide uppercase">
              Approver&apos;s note
            </p>
            <p className="text-sm leading-relaxed break-words">{detail.decisionReason}</p>
          </div>
        ) : null}

        {detail.attachments.length ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Documents
            </p>
            <DocumentList documents={detail.attachments} resolveUrl={detail.resolveUrl} />
          </div>
        ) : null}

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
