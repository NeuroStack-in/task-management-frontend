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
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
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

const STATUS_TABS: { value: ApprovalStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STATUS_BADGE: Record<ApprovalStatus, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
};

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");

  const [items, setItems] = useState<ApprovalRequest[]>(APPROVALS);
  const [tab, setTab] = useState<ApprovalStatus | "all">("pending");

  const pending = items.filter((a) => a.status === "pending").length;
  const approved = items.filter((a) => a.status === "approved").length;
  const rejected = items.filter((a) => a.status === "rejected").length;

  const visible = tab === "all" ? items : items.filter((a) => a.status === tab);

  const decide = (req: ApprovalRequest, status: ApprovalStatus) => {
    setItems((prev) =>
      prev.map((a) => (a.id === req.id ? { ...a, status } : a)),
    );
    toast.success(status === "approved" ? "Request approved" : "Request rejected", {
      description: `${KIND_META[req.kind].label} · ${req.requester.name}`,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approval Center"
        description="Review timesheets, leave, manual entries, and corrections in one queue."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending"
          value={pending}
          icon={ClipboardCheck}
          hint="awaiting you"
          trend={[3, 5, 4, 6, 5, 7, pending]}
          featured
        />
        <StatCard
          label="Approved"
          value={approved}
          icon={Check}
          delta={8}
          trend={[10, 12, 11, 14, 13, 15, approved + 12]}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          icon={X}
          trend={[2, 1, 2, 1, 1, 2, rejected + 1]}
        />
        <StatCard
          label="Avg response"
          value="3.2h"
          icon={Clock}
          delta={-12}
          trend={[6, 5, 5, 4, 4, 3, 3]}
        />
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const count =
            t.value === "pending"
              ? pending
              : t.value === "approved"
                ? approved
                : t.value === "rejected"
                  ? rejected
                  : items.length;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
              )}
            >
              {t.label} · {count}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review"
          description="No requests in this view. New submissions land here for approval."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((req) => {
            const Icon = KIND_ICON[req.kind];
            return (
              <Card key={req.id} className="p-0">
                <CardContent className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{req.title}</span>
                      <Badge variant="outline">{KIND_META[req.kind].label}</Badge>
                      <Badge className={cn("border-0", STATUS_BADGE[req.status])}>
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.detail}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Avatar className="size-5">
                        <AvatarImage
                          src={req.requester.avatarUrl}
                          alt={req.requester.name}
                        />
                        <AvatarFallback className="text-[9px]">
                          {initials(req.requester.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {req.requester.name} · {req.submitted}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                    <span className="font-mono text-sm font-medium tabular-nums">
                      {req.amount}
                    </span>
                    {req.status === "pending" && canApprove ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(req, "approved")}>
                          <Check className="size-4" /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => decide(req, "rejected")}
                        >
                          <X className="size-4" /> Reject
                        </Button>
                      </div>
                    ) : req.status === "pending" && !canApprove ? (
                      <span className="text-xs text-muted-foreground">
                        View only
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
