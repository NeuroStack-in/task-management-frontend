"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarOff,
  Check,
  ClipboardCheck,
  X,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getLeaveDocumentUrl } from "@/modules/leave/services/leave.service";
import { DocumentList } from "@/components/shared/document-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { useApprovals, type ApprovalItem } from "../use-approvals";
import { cn } from "@/lib/utils";

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
const dayLabel = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

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
                  <TableHead className="w-[22%]">Requester</TableHead>
                  <TableHead className="w-[13%]">Type</TableHead>
                  <TableHead className="w-[26%]">Summary</TableHead>
                  <TableHead className="w-[11%]">Duration</TableHead>
                  <TableHead className="w-[12%]">Submitted</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
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
                        <Avatar className="size-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {initials(req.requesterName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate font-medium">{req.requesterName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <CalendarOff className="size-3" />
                        {req.typeName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="block truncate">{fmtRange(req.from, req.to)}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium tabular-nums">
                      {dayLabel(req.days)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtSubmitted(req.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0 capitalize", STATUS_BADGE[req.status] ?? "bg-muted")}>
                        {req.status}
                      </Badge>
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
              <Avatar className="size-10">
                <AvatarFallback>{initials(req.requesterName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{req.requesterName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {fmtRange(req.from, req.to)}
                </p>
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {dayLabel(req.days)}
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

