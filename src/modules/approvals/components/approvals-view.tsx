"use client";

import { useState } from "react";
import {
  CalendarOff,
  Check,
  ClipboardCheck,
  Clock,
  PencilLine,
  Timer,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  timesheet: Timer,
  leave: CalendarOff,
  "manual-entry": Clock,
  correction: PencilLine,
};

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
};

const FILTERS: { value: ApprovalStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");

  const [items, setItems] = useState<ApprovalRequest[]>(APPROVALS);
  const [filter, setFilter] = useState<ApprovalStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(
    APPROVALS.find((a) => a.status === "pending")?.id ?? null,
  );

  const counts = {
    pending: items.filter((a) => a.status === "pending").length,
    approved: items.filter((a) => a.status === "approved").length,
    rejected: items.filter((a) => a.status === "rejected").length,
  };

  const queue = items.filter((a) => a.status === filter);
  const selected =
    queue.find((a) => a.id === selectedId) ?? queue[0] ?? null;

  const pickFilter = (f: ApprovalStatus) => {
    setFilter(f);
    setSelectedId(items.find((a) => a.status === f)?.id ?? null);
  };

  const decide = (req: ApprovalRequest, status: ApprovalStatus) => {
    setItems((prev) =>
      prev.map((a) => (a.id === req.id ? { ...a, status } : a)),
    );
    toast.success(status === "approved" ? "Request approved" : "Request rejected", {
      description: `${KIND_META[req.kind].label} · ${req.requester.name}`,
    });
    if (filter === "pending") {
      const next = queue.find((a) => a.id !== req.id);
      setSelectedId(next?.id ?? null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Center"
        description={`${counts.pending} pending · review timesheets, leave, manual entries, and corrections`}
      />

      <Card className="grid h-[70vh] min-h-[580px] gap-0 overflow-hidden p-0 lg:grid-cols-[360px_1fr]">
        {/* Queue */}
        <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">
          <div className="flex gap-1 border-b p-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => pickFilter(f.value)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                  filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label} · {counts[f.value]}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing {filter}.
              </p>
            ) : (
              queue.map((req) => (
                <QueueRow
                  key={req.id}
                  request={req}
                  active={selected?.id === req.id}
                  onClick={() => setSelectedId(req.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Review panel */}
        <section className="min-h-0 overflow-y-auto">
          {selected ? (
            <ReviewPanel
              request={selected}
              canApprove={canApprove}
              onDecide={decide}
            />
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing to review"
              description="No requests in this view. Pick another tab on the left."
              className="m-6 border-0"
            />
          )}
        </section>
      </Card>
    </div>
  );
}

function QueueRow({
  request: req,
  active,
  onClick,
}: {
  request: ApprovalRequest;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = KIND_ICON[req.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent/50",
        active && "bg-feature-tint/50",
      )}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-sm font-medium">
            {req.title}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {req.submitted}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {req.requester.name} · {KIND_META[req.kind].label}
        </p>
        <span className="mt-1 inline-block font-mono text-xs font-medium tabular-nums text-foreground">
          {req.amount}
        </span>
      </div>
    </button>
  );
}

function ReviewPanel({
  request: req,
  canApprove,
  onDecide,
}: {
  request: ApprovalRequest;
  canApprove: boolean;
  onDecide: (req: ApprovalRequest, status: ApprovalStatus) => void;
}) {
  const Icon = KIND_ICON[req.kind];
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-feature-tint text-primary">
              <Icon className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold">{req.title}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">{KIND_META[req.kind].label}</Badge>
                <Badge className={cn("border-0", STATUS_BADGE[req.status])}>
                  {req.status}
                </Badge>
              </div>
            </div>
          </div>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {req.amount}
          </span>
        </div>

        {/* Requester */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <Avatar className="size-10">
            <AvatarImage src={req.requester.avatarUrl} alt={req.requester.name} />
            <AvatarFallback>{initials(req.requester.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{req.requester.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {req.requester.jobTitle} · {req.requester.department}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-3 gap-3">
          <MetaCell label="Type" value={KIND_META[req.kind].label} />
          <MetaCell label="Amount" value={req.amount} mono />
          <MetaCell label="Submitted" value={req.submitted} />
        </div>

        {/* Detail */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Request
          </p>
          <p className="text-sm leading-relaxed">{req.detail}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t p-4">
        {req.status !== "pending" ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
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
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onDecide(req, "rejected")}
            >
              <X className="size-4" /> Reject
            </Button>
            <Button className="flex-1" onClick={() => onDecide(req, "approved")}>
              <Check className="size-4" /> Approve
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            You have view-only access to approvals.
          </p>
        )}
      </div>
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-medium", mono && "font-mono tabular-nums")}>
        {value}
      </p>
    </div>
  );
}
