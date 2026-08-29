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

/** `14:30` → `2:30 pm`. Stored 24-hour; nobody reads a leave request that way. */
export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export interface LeaveDetail {
  /** Leave type — the dialog's title. */
  typeName: string;
  status: string;
  statusClass: string;
  /** "Submitted Aug 29". */
  submittedLabel: string;
  /** Shown only when the reader isn't the requester (the approver's view). */
  person?: { userId: string; name: string };
  /** "Aug 31, 2026" or "Aug 19 – Aug 21, 2026". */
  dateLabel: string;
  /** The figure: "1 day" / "2h". */
  valueLabel: string;
  /** `HH:MM` window for a permission, else null. */
  fromTime?: string;
  toTime?: string;
  reason?: string;
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
      ? `${fmt12(detail.fromTime)} to ${fmt12(detail.toTime)}`
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
            {/* The one thing a permission is actually decided on: which hours the person is away. */}
            {window ? (
              <p className="text-foreground truncate text-sm">Permission from {window}</p>
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
