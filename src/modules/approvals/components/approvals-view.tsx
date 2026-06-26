"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarOff,
  Check,
  ClipboardCheck,
  Clock,
  PencilLine,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
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

type Filter = ApprovalStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");

  const [items, setItems] = useState<ApprovalRequest[]>(APPROVALS);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = items.find((a) => a.id === selectedId) ?? null;

  // The Actions column only matters when there's something to act on.
  const showActions = canApprove && rows.some((r) => r.status === "pending");

  const decide = (req: ApprovalRequest, status: ApprovalStatus) => {
    setItems((prev) =>
      prev.map((a) => (a.id === req.id ? { ...a, status } : a)),
    );
    setSelectedId(null);
    toast.success(status === "approved" ? "Request approved" : "Request rejected", {
      description: `${KIND_META[req.kind].label} · ${req.requester.name}`,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Center"
        description={`${counts.pending} pending · review time-record changes, manual entries, and leave`}
      />

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
            {f.label} · {counts[f.value]}
          </button>
        ))}
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
            <Table className="min-w-[860px] table-fixed [&_td]:px-4 [&_th]:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Requester</TableHead>
                  <TableHead className="w-[13%]">Type</TableHead>
                  <TableHead className="w-[26%]">Request</TableHead>
                  <TableHead className="w-[11%] text-right">Amount</TableHead>
                  <TableHead className="w-[12%]">Submitted</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  {showActions ? (
                    <TableHead className="w-[8%] text-right">Actions</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((req) => {
                  const Icon = KIND_ICON[req.kind];
                  return (
                    <TableRow
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className="group cursor-pointer"
                    >
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
                        <span className="block truncate">{req.title}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                        {req.amount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {req.submitted}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("border-0 capitalize", STATUS_BADGE[req.status])}>
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
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
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
