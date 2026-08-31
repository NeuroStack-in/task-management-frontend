"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarOff, Check, ClipboardCheck, Paperclip, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { getLeaveDocumentUrl } from "@/modules/leave/services/leave.service";
import { DocumentList } from "@/components/shared/document-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { useApprovals, type ApprovalItem } from "../use-approvals";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const SHORT_MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${SHORT_MONTH[m - 1]} ${d}`;
};
const fmtRange = (from: string, to: string) =>
  from === to ? `${fmtDay(from)}, ${from.slice(0, 4)}` : `${fmtDay(from)} – ${fmtDay(to)}, ${to.slice(0, 4)}`;
const fmtSubmitted = (ms?: number) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${SHORT_MONTH[d.getMonth()]} ${d.getDate()}`;
};
/** `14:30` → `2:30 pm`. The stored form is 24h; the sentence an approver reads is not. */
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** The big figure in the dialog. The window is prose on the line beneath, not crammed in here. */
function requestValue(r: { days: number; permissionMinutes?: number }): string {
  const mins = r.permissionMinutes ?? 0;
  if (mins > 0) return formatMinutes(mins);
  return `${r.days} day${r.days === 1 ? "" : "s"}`;
}

/** "10:30 am to 12:30 pm" — what the approver is actually being asked to allow. */
function permissionWindow(r: {
  permissionMinutes?: number;
  fromTime?: string;
  toTime?: string;
}): string | null {
  if ((r.permissionMinutes ?? 0) <= 0 || !r.fromTime || !r.toTime) return null;
  return `${fmt12(r.fromTime)} to ${fmt12(r.toTime)}`;
}

type Filter = "pending" | "approved" | "rejected" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");
  const { items, counts, loading, error, reload, decide } = useApprovals();

  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const rows = useMemo(
    () => items.filter((a) => filter === "all" || a.status === filter),
    [items, filter],
  );

  const selected = items.find((a) => a.requestId === selectedId) ?? null;
  const showActions = canApprove && rows.some((r) => r.status === "pending");

  // Publish the approval queue's counts + active filter to the assistant.
  useAssistantPageContext({
    facts: [
      { label: "Pending", value: String(counts.pending ?? 0) },
      { label: "Approved", value: String(counts.approved ?? 0) },
      { label: "Rejected", value: String(counts.rejected ?? 0) },
      { label: "Filter", value: filter },
      { label: "Showing", value: String(rows.length) },
    ],
  });

  const runDecide = async (item: ApprovalItem, decision: "approve" | "reject") => {
    setDeciding(item.requestId);
    try {
      await decide(item, decision);
      setSelectedId(null);
      toast.success(decision === "approve" ? "Request approved" : "Request rejected", {
        description: `${item.typeName} · ${item.requesterName}`,
      });
    } catch {
      toast.error("Couldn't record the decision. Try again.");
    } finally {
      setDeciding(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        description={`${counts.pending ?? 0} pending · review and decide time-off requests`}
      />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert className="size-4 text-warning" /> {error}
          </span>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
            )}
          >
            {f.label} · {counts[f.value] ?? 0}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <Card className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review"
          description="No requests in this view. Try another status filter."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[860px] table-fixed [&_td]:px-4 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  {/* Same shape as the employee's "My requests": Request / Reason / Documents /
                      Status, with Requester in front because this queue spans people. Type, dates
                      and duration were three columns answering one question, and Duration at 11%
                      could not hold "Permission · 1.5h · 10:30 am to 12:00 pm" — it ran under the
                      Submitted column. Stacked in one cell it fits and reads in order. */}
                  <TableHead className="w-[20%]">Requester</TableHead>
                  <TableHead className="w-[26%]">Request</TableHead>
                  <TableHead className="w-[22%]">Reason</TableHead>
                  <TableHead className="w-[12%]">Documents</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  {showActions ? (
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((req) => (
                  <TableRow
                    key={req.requestId}
                    onClick={() => setSelectedId(req.requestId)}
                    className="group cursor-pointer"
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          userId={req.userId}
                          name={req.requesterName}
                          className="size-7 shrink-0"
                          fallbackClassName="text-[10px]"
                        />
                        <span className="truncate font-medium">{req.requesterName}</span>
                      </div>
                    </TableCell>
                      {/* Type, when, and how long — one question, one cell. */}
                      <TableCell className="align-top">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="gap-1">
                            <CalendarOff className="size-3" />
                            {req.typeName}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {fmtRange(req.from, req.to)}
                          {" · "}
                          {requestValue(req)}
                        </p>
                        {permissionWindow(req) ? (
                          <p className="text-muted-foreground text-sm">{permissionWindow(req)}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        <span className="line-clamp-2" title={req.reason ?? undefined}>
                          {req.reason ?? "—"}
                        </span>
                      </TableCell>
                      {/* A count, not the filename: the full list (with view/download) is in the dialog this
                          row opens, and a name like
                          "How-the-Productivity-Score-Is-Calculated.pdf" swallowed the row. */}
                      <TableCell className="text-muted-foreground align-top">
                        {req.attachments.length ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-sm"
                            title={req.attachments.map((a) => a.filename).join(", ")}
                          >
                            <Paperclip className="size-3.5" />
                            {req.attachments.length} file{req.attachments.length === 1 ? "" : "s"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    <TableCell className="align-top">
                      <Badge className={cn("border-0 capitalize", STATUS_BADGE[req.status] ?? "bg-muted")}>
                        {req.status}
                      </Badge>
                      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                        Sent {fmtSubmitted(req.createdAt)}
                      </p>
                    </TableCell>
                    {showActions ? (
                      <TableCell className="text-right">
                        {req.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-success hover:text-success"
                              aria-label="Approve"
                              disabled={deciding === req.requestId}
                              onClick={(e) => {
                                e.stopPropagation();
                                runDecide(req, "approve");
                              }}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              aria-label="Reject"
                              disabled={deciding === req.requestId}
                              onClick={(e) => {
                                e.stopPropagation();
                                runDecide(req, "reject");
                              }}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ApprovalDialog
        request={selected}
        canApprove={canApprove}
        busy={deciding === selected?.requestId}
        onClose={() => setSelectedId(null)}
        onDecide={runDecide}
      />
    </div>
  );
}

function ApprovalDialog({
  request: req,
  canApprove,
  busy,
  onClose,
  onDecide,
}: {
  request: ApprovalItem | null;
  canApprove: boolean;
  busy: boolean;
  onClose: () => void;
  onDecide: (req: ApprovalItem, decision: "approve" | "reject") => void;
}) {
  const initialFocusRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" initialFocus={initialFocusRef}>
        {req ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {req.typeName}
                <Badge className={cn("border-0 capitalize", STATUS_BADGE[req.status] ?? "bg-muted")}>
                  {req.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>Submitted {fmtSubmitted(req.createdAt)}</DialogDescription>
            </DialogHeader>

            <div
              ref={initialFocusRef}
              tabIndex={-1}
              className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 outline-none"
            >
              <UserAvatar userId={req.userId} name={req.requesterName} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{req.requesterName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {fmtRange(req.from, req.to)}
                </p>
                {/* The one thing an approver of a permission actually decides on: which hours the
                    person will be away. "0.25 days" said none of it. */}
                {permissionWindow(req) ? (
                  <p className="text-foreground truncate text-sm">
                    Requested permission from {permissionWindow(req)}
                  </p>
                ) : null}
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {requestValue(req)}
              </span>
            </div>

            {req.reason ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p className="text-sm leading-relaxed">{req.reason}</p>
              </div>
            ) : null}

            {req.attachments.length ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Documents
                </p>
                <DocumentList
                  documents={req.attachments}
                  resolveUrl={(id) =>
                    getLeaveDocumentUrl(req.userId, req.requestId, id).then((r) => r.url)
                  }
                />
              </div>
            ) : null}

            <DialogFooter>
              {req.status !== "pending" ? (
                <div
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
                    STATUS_BADGE[req.status] ?? "bg-muted",
                  )}
                >
                  {req.status === "approved" ? <Check className="size-4" /> : <X className="size-4" />}
                  This request was {req.status}.
                </div>
              ) : canApprove ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => onDecide(req, "reject")}>
                    <X className="size-4" /> Reject
                  </Button>
                  <Button disabled={busy} onClick={() => onDecide(req, "approve")}>
                    <Check className="size-4" /> Approve
                  </Button>
                </>
              ) : (
                <p className="w-full text-center text-sm text-muted-foreground">
                  You have view-only access to approvals.
                </p>
              )}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

