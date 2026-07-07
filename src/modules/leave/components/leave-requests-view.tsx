"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plane, CalendarPlus, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";
import {
  useLeaveStore,
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  type LeaveStatus,
} from "@/stores/leave-requests.store";
import { cn } from "@/lib/utils";
import { RequestLeaveDialog } from "./request-leave-dialog";

const STATUS_META: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
  approved: { label: "Approved", cls: "bg-success/12 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/12 text-destructive" },
};

const SHORT_MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${SHORT_MONTH[m - 1]} ${d}`;
};
const fmtRange = (start: string, end: string) =>
  start === end
    ? `${fmtDay(start)}, ${start.slice(0, 4)}`
    : `${fmtDay(start)} – ${fmtDay(end)}, ${end.slice(0, 4)}`;

export function LeaveRequestsView() {
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const requests = useLeaveStore((s) => s.requests);
  const cancelRequest = useLeaveStore((s) => s.cancelRequest);
  const seedFor = useLeaveStore((s) => s.seedFor);
  const [open, setOpen] = useState(false);

  const userId = user?.id ?? "";

  // Give a fresh demo user some leave history so the page isn't blank (once).
  useEffect(() => {
    if (user?.id) seedFor(user.id, user.name);
  }, [user?.id, user?.name, seedFor]);
  const mine = useMemo(
    () =>
      requests
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [requests, userId],
  );

  // Balances per allowance-bearing type: pending + approved days count as used.
  const balances = useMemo(
    () =>
      LEAVE_TYPES.filter((t) => t.allowance !== null).map((t) => {
        const used = mine
          .filter((r) => r.type === t.value && r.status !== "rejected")
          .reduce((sum, r) => sum + r.days, 0);
        const allowance = t.allowance as number;
        return { ...t, allowance, used, remaining: Math.max(0, allowance - used) };
      }),
    [mine],
  );

  const handleCancel = (id: string) => {
    cancelRequest(id);
    toast.success("Request withdrawn");
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Request time off and track the status of your leave."
      />

      {/* Balances */}
      <div className="grid gap-4 sm:grid-cols-3">
        {balances.map((b) => {
          const pct = Math.round((b.used / b.allowance) * 100);
          return (
            <Card key={b.value} className="gap-2 p-5">
              <p className="text-sm text-muted-foreground">{b.label}</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {b.remaining}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  / {b.allowance} days
                </span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {b.used} used · {b.remaining} remaining
              </p>
            </Card>
          );
        })}
      </div>

      {/* Requests */}
      <Card className="flex-1 p-0 [--card-spacing:0px]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">
            My requests
          </h2>
          {can("leave:request") ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <CalendarPlus className="size-4" /> Request leave
            </Button>
          ) : null}
        </div>
        {mine.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-5">
            <EmptyState
              icon={Plane}
              title="No leave requests yet"
              description="Request time off and it will appear here with its approval status."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="pr-5">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-5 font-medium">
                    {LEAVE_TYPE_LABEL[r.type]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtRange(r.startDate, r.endDate)}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.days}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                    {r.reason}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("font-medium", STATUS_META[r.status].cls)}>
                      {STATUS_META[r.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {fmtDay(r.submittedAt)}
                  </TableCell>
                  <TableCell className="pr-5">
                    {r.status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(r.id)}
                      >
                        <X className="size-4" /> Withdraw
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RequestLeaveDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
