"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plane, CalendarPlus, X, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { useLeave } from "../use-leave";
import { cn } from "@/lib/utils";
import { RequestLeaveDialog } from "./request-leave-dialog";
import { LeaveTypesManager } from "./leave-types-manager";
import { DocumentList } from "@/components/shared/document-list";
import { useAuthStore } from "@/stores/auth.store";
import { getLeaveDocumentUrl } from "../services/leave.service";
import { OrgBalancesTable } from "./org-balances-table";

/** The server's request states (LLD §8): pending → approved, or pending/approved → cancelled. */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
  approved: { label: "Approved", cls: "bg-success/12 text-success" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
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

/** Epoch ms → "Jul 20", or "—" when the server didn't stamp a created_at. */
const fmtSubmitted = (ms?: number) => {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${SHORT_MONTH[d.getMonth()]} ${d.getDate()}`;
};

/**
 * The Leave page, which is two different pages behind one route.
 *
 * **`leave:manage` (Owner/Admin) → the oversight view**: the leave-type catalog, every employee's
 * balance, and the per-person allowance editor. They do not see a "my leave" section — an
 * Owner/Admin holds no `leave:request` (it is contributor-only, like `TimeTrackSelf`), so there is
 * no request for them to make and a personal balance card would read as a bug.
 *
 * **Everyone else → the employee view** they already had: balances, their requests, and the request
 * dialog. Unchanged.
 *
 * The route is reachable by both because the nav entry pairs `anyPermissions` with
 * `permission: null` (see `constants/navigation.ts`); this is where the two audiences actually part.
 */
export function LeaveRequestsView() {
  const { can } = usePermissions();
  if (can("leave:manage")) return <AdminLeaveView />;
  return <EmployeeLeaveView />;
}

/** Sections 1–3: the type catalog, the org ledger, and per-person adjustments. */
function AdminLeaveView() {
  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Leave types and allowances, and every employee's balance."
      />
      {/* 1 — the catalog: types and how many days a year each carries. Editing an allowance here
          applies to everyone's current-year balance, except figures an admin has hand-set. */}
      <LeaveTypesManager />
      {/* 2 + 3 — who has used what, and the editor for one person's allowance. */}
      <OrgBalancesTable />
    </div>
  );
}

function EmployeeLeaveView() {
  const { can } = usePermissions();
  // The download route is keyed by owner, and on this page the owner is always the viewer.
  const myUserId = useAuthStore((st) => st.user?.id ?? "");
  const leave = useLeave();
  const { balances, requests, types, typeName, loading, error, submit, cancel } = leave;
  const [open, setOpen] = useState(false);
  // Only active types are requestable — the server rejects an archived `type_id` anyway.
  const requestableTypes = types.filter((t) => t.active !== false);

  const handleCancel = async (id: string) => {
    try {
      await cancel(id);
      toast.success("Request withdrawn");
    } catch {
      toast.error("Couldn't withdraw the request. Try again.");
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Request time off and track the status of your leave."
      />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert className="size-4 text-warning" /> {error}
          </span>
          <Button variant="outline" size="sm" onClick={leave.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Balances — computed server-side (LLD §8). Only allowance-bearing types show a bar. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {loading && balances.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="gap-2 p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-1.5 w-full" />
              </Card>
            ))
          : balances
              .filter((b) => b.allowance > 0)
              .map((b) => {
                const pct = b.allowance ? Math.round((b.used / b.allowance) * 100) : 0;
                return (
                  <Card key={b.type_id} className="gap-2 p-5">
                    <p className="text-sm text-muted-foreground">{b.name}</p>
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
                      {b.used} taken · {b.remaining} available
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
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              disabled={requestableTypes.length === 0}
            >
              <CalendarPlus className="size-4" /> Request leave
            </Button>
          ) : null}
        </div>
        {loading && requests.length === 0 ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
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
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="pr-5">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const meta = STATUS_META[r.status] ?? {
                  label: r.status,
                  cls: "bg-muted text-muted-foreground",
                };
                return (
                  <TableRow key={r.request_id}>
                    <TableCell className="pl-5 font-medium">{typeName(r.type_id)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtRange(r.from, r.to)}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.days}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                      {r.reason ?? "—"}
                    </TableCell>
                    <TableCell className="min-w-[13rem]">
                      {r.attachments?.length ? (
                        <DocumentList
                          documents={r.attachments}
                          resolveUrl={(id) =>
                            getLeaveDocumentUrl(myUserId, r.request_id, id).then((x) => x.url)
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-medium", meta.cls)}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fmtSubmitted(r.created_at)}
                    </TableCell>
                    <TableCell className="pr-5">
                      {r.status === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancel(r.request_id)}
                        >
                          <X className="size-4" /> Withdraw
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>



      <RequestLeaveDialog
        open={open}
        onOpenChange={setOpen}
        types={requestableTypes}
        onSubmit={submit}
      />
    </div>
  );
}
