"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarOff,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock,
  PencilLine,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { AiInsight } from "@/components/shared/ai-insight";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import {
  APPROVALS,
  KIND_META,
  type ApprovalKind,
  type ApprovalRequest,
  type ApprovalStatus,
} from "@/lib/mock-approvals";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ApprovalKind, LucideIcon> = {
  "time-change": PencilLine,
  "manual-entry": Clock,
  leave: CalendarOff,
};

/** Sort order so requests of the same type sit together in the table. */
const KIND_ORDER: ApprovalKind[] = ["time-change", "manual-entry", "leave"];

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
};

const STATUS_ICON: Record<ApprovalStatus, LucideIcon> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

type Filter = ApprovalStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/** Entries submitted outside normal hours (before 08:00 or after 20:00) */
function isUnusualHours(submitted: string): boolean {
  // The mock data uses relative strings like "12m ago", "1h ago", "Yesterday"
  // Flag entries with a large time gap (>= 5h ago suggests unusual hours for a workday)
  return submitted === "Yesterday" || submitted === "2 days ago";
}

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");

  const [items, setItems] = useState<ApprovalRequest[]>(APPROVALS);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const counts = {
    all: items.length,
    pending: items.filter((a) => a.status === "pending").length,
    approved: items.filter((a) => a.status === "approved").length,
    rejected: items.filter((a) => a.status === "rejected").length,
  };

  const rows = useMemo(
    () =>
      items
        .filter((a) => filter === "all" || a.status === filter)
        .sort(
          (a, b) =>
            KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
        ),
    [items, filter],
  );

  const pendingRows = rows.filter((r) => r.status === "pending");
  const unusualCount = items.filter(
    (a) => a.status === "pending" && isUnusualHours(a.submitted),
  ).length;

  const selected = items.find((a) => a.id === selectedId) ?? null;

  // Actions column is always reserved when canApprove; cell content depends on row status.
  const showActionsCol = canApprove;

  const allPendingSelected =
    pendingRows.length > 0 &&
    pendingRows.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const decide = (req: ApprovalRequest, status: ApprovalStatus) => {
    setItems((prev) =>
      prev.map((a) => (a.id === req.id ? { ...a, status } : a)),
    );
    setSelectedId(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(req.id);
      return next;
    });
    toast.success(status === "approved" ? "Request approved" : "Request rejected", {
      description: `${KIND_META[req.kind].label} · ${req.requester.name}`,
    });
  };

  const bulkDecide = (status: ApprovalStatus) => {
    const targets = [...selectedIds];
    setItems((prev) =>
      prev.map((a) => (targets.includes(a.id) ? { ...a, status } : a)),
    );
    setSelectedIds(new Set());
    toast.success(
      status === "approved"
        ? `${targets.length} request${targets.length === 1 ? "" : "s"} approved`
        : `${targets.length} request${targets.length === 1 ? "" : "s"} rejected`,
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Center"
        description={`${counts.pending} pending · review time-record changes, manual entries, and leave`}
      />

      {/* AI insight — only shows when there are unusual-hours pending entries */}
      {unusualCount > 0 && (
        <AiInsight
          title={`${unusualCount} request${unusualCount === 1 ? "" : "s"} submitted outside working hours`}
          detail="Entries submitted very late or the prior day can indicate forgotten tracking or retroactive edits — review carefully before approving."
          basis={`${items.filter((a) => a.status === "pending").length} pending requests analysed`}
          action={{ label: "View pending", onClick: () => setFilter("pending") }}
        />
      )}

      {/* Status filter + bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
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
            {f.label} · {counts[f.value]}
          </button>
        ))}

        {canApprove && selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkDecide("approved")}
            >
              <Check className="size-3.5" /> Approve all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => bulkDecide("rejected")}
            >
              <X className="size-3.5" /> Reject all
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review"
          description="No requests in this view. Try another status filter."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            {/*
              Actions column always present when canApprove — fixed widths prevent
              column-count shifts between pending/approved/rejected filter tabs.
            */}
            <Table
              className={cn(
                "table-fixed [&_td]:px-4 [&_th]:px-4",
                showActionsCol ? "min-w-[920px]" : "min-w-[800px]",
              )}
            >
              <TableHeader>
                <TableRow>
                  {canApprove && (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all pending"
                        checked={allPendingSelected}
                        onChange={toggleSelectAll}
                        className="size-4 cursor-pointer accent-primary"
                        disabled={pendingRows.length === 0}
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[22%]">Requester</TableHead>
                  <TableHead className="w-[14%]">Type</TableHead>
                  <TableHead className="w-[26%]">Request</TableHead>
                  <TableHead className="w-[12%] text-right">Amount</TableHead>
                  <TableHead className="w-[11%]">Submitted</TableHead>
                  <TableHead className="w-[11%]">Status</TableHead>
                  {showActionsCol && (
                    <TableHead className="w-[10%] text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((req) => {
                  const Icon = KIND_ICON[req.kind];
                  const StatusIcon = STATUS_ICON[req.status];
                  const isChecked = selectedIds.has(req.id);
                  return (
                    <TableRow
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className="group cursor-pointer"
                      data-selected={isChecked || undefined}
                    >
                      {canApprove && (
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                        >
                          {req.status === "pending" ? (
                            <input
                              type="checkbox"
                              aria-label={`Select ${req.requester.name}`}
                              checked={isChecked}
                              onChange={() => toggleRow(req.id)}
                              className="size-4 cursor-pointer accent-primary"
                            />
                          ) : (
                            <span className="inline-block size-4" />
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-7 shrink-0">
                            <AvatarImage
                              src={req.requester.avatarUrl}
                              alt={req.requester.name}
                            />
                            <AvatarFallback className="text-[10px]">
                              {initials(req.requester.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate font-medium">
                            {req.requester.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="size-3" />
                          {KIND_META[req.kind].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger
                            render={<span className="block truncate" />}
                          >
                            {req.title}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            {req.title}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                        {req.amount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {req.submitted}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "gap-1 border-0 capitalize",
                            STATUS_BADGE[req.status],
                          )}
                        >
                          <StatusIcon className="size-3" />
                          {req.status}
                        </Badge>
                      </TableCell>
                      {showActionsCol && (
                        <TableCell className="text-right">
                          {req.status === "pending" ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-success hover:text-success"
                                aria-label="Approve"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  decide(req, "approved");
                                }}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                aria-label="Reject"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  decide(req, "rejected");
                                }}
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            /* Reserved space — keeps column width stable */
                            <span className="inline-flex size-7 items-center justify-center text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <ApprovalDialog
        request={selected}
        canApprove={canApprove}
        onClose={() => setSelectedId(null)}
        onDecide={decide}
      />
    </div>
  );
}

function ApprovalDialog({
  request: req,
  canApprove,
  onClose,
  onDecide,
}: {
  request: ApprovalRequest | null;
  canApprove: boolean;
  onClose: () => void;
  onDecide: (req: ApprovalRequest, status: ApprovalStatus) => void;
}) {
  // Land initial focus on a neutral element so the destructive "Reject" button
  // isn't pre-highlighted when the dialog opens.
  const initialFocusRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" initialFocus={initialFocusRef}>
        {req ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {req.title}
                <Badge variant="outline">{KIND_META[req.kind].label}</Badge>
                <Badge className={cn("border-0 capitalize", STATUS_BADGE[req.status])}>
                  {req.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>Submitted {req.submitted}</DialogDescription>
            </DialogHeader>

            {/* Requester */}
            <div
              ref={initialFocusRef}
              tabIndex={-1}
              className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 outline-none"
            >
              <Avatar className="size-10">
                <AvatarImage
                  src={req.requester.avatarUrl}
                  alt={req.requester.name}
                />
                <AvatarFallback>{initials(req.requester.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{req.requester.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {req.requester.jobTitle} · {req.requester.department}
                </p>
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {req.amount}
              </span>
            </div>

            {/* Full description */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-relaxed">{req.detail}</p>
            </div>

            <DialogFooter>
              {req.status !== "pending" ? (
                <div
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
                    STATUS_BADGE[req.status],
                  )}
                >
                  {req.status === "approved" ? (
                    <Check className="size-4" />
                  ) : (
                    <X className="size-4" />
                  )}
                  This request was {req.status}.
                </div>
              ) : canApprove ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onDecide(req, "rejected")}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button onClick={() => onDecide(req, "approved")}>
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
