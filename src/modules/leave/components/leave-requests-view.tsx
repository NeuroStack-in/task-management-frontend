"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Paperclip, Plane, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
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
import { formatDays } from "../lib/days";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  RequestLeaveDialog,
  yearPortions,
  type BalanceLookup,
} from "./request-leave-dialog";
import { RecordLeaveButton } from "./record-leave-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LeaveTypesManager } from "./leave-types-manager";
import { LeaveDetailDialog } from "./leave-detail-dialog";
import { useAuthStore } from "@/stores/auth.store";
import { useAssistantPageContext } from "@/stores/page-context.store";
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
 *
 * **Someone who holds both** — an Admin, or the "manager who also takes leave" custom role that
 * LEAVES.md recommends — gets both, behind a My leave / Manage leave switch. The page used to be
 * either/or on `leave:manage`, so those people could never request leave or see their own balance
 * anywhere in the product (QA audit 2026-10-08, WP-264).
 */
export function LeaveRequestsView() {
  const { can } = usePermissions();
  const manages = can("leave:manage");
  const requests = can("leave:request");
  const [view, setView] = useState<"mine" | "manage">("manage");
  if (manages && requests) {
    return (
      <div className="flex min-h-full flex-col gap-3">
        <div role="tablist" aria-label="Leave views" className="inline-flex w-fit gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            role="tab"
            aria-selected={view === "mine"}
            variant={view === "mine" ? "default" : "ghost"}
            onClick={() => setView("mine")}
          >
            My leave
          </Button>
          <Button
            size="sm"
            role="tab"
            aria-selected={view === "manage"}
            variant={view === "manage" ? "default" : "ghost"}
            onClick={() => setView("manage")}
          >
            Manage leave
          </Button>
        </div>
        {view === "mine" ? <EmployeeLeaveView /> : <AdminLeaveView />}
      </div>
    );
  }
  if (manages) return <AdminLeaveView />;
  return <EmployeeLeaveView />;
}

/** Sections 1–3: the type catalog, the org ledger, and per-person adjustments. */
function AdminLeaveView() {
  // A catalog save rewrites this year's balances and can add or archive a column, so the ledger
  // below remounts (and reloads) after one. It loaded once and kept showing "/ 20" after Annual
  // was raised to 25, until a full page reload (QA audit 2026-10-08, WP-266).
  const [ledgerKey, setLedgerKey] = useState(0);
  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Leave types and allowances, and every employee's balance."
        // Record leave someone reported — including a sick day already past (TIME-04).
        actions={<RecordLeaveButton />}
      />
      {/* 1 — the catalog: types and how many days a year each carries. Editing an allowance here
          applies to everyone's current-year balance, except figures an admin has hand-set. */}
      <LeaveTypesManager onCatalogChanged={() => setLedgerKey((k) => k + 1)} />
      {/* 2 + 3 — who has used what, and the editor for one person's allowance. */}
      <OrgBalancesTable key={ledgerKey} />
    </div>
  );
}

function EmployeeLeaveView() {
  const { can } = usePermissions();
  // The download route is keyed by owner, and on this page the owner is always the viewer.
  const myUserId = useAuthStore((st) => st.user?.id ?? "");
  const leave = useLeave();
  const { balances, balanceYear, requests, types, typeName, loading, error, submit, cancel } = leave;
  // What the request dialog shows against the balance (TIME-07): the server's figures for the loaded
  // year, plus the days this person already has waiting in that type and year.
  const balanceFor = useMemo<BalanceLookup>(
    () => (typeId, year) => {
      if (year !== balanceYear) return null;
      const b = balances.find((x) => x.type_id === typeId);
      if (!b) return null;
      const pending = requests
        .filter((r) => r.status === "pending" && r.type_id === typeId)
        .reduce(
          (sum, r) => sum + (yearPortions(r.from, r.to, r.days).find(([y]) => y === year)?.[1] ?? 0),
          0,
        );
      return { allowance: b.allowance, used: b.used, pending };
    },
    [balances, balanceYear, requests],
  );
  const [open, setOpen] = useState(false);
  /** The request whose detail dialog is open — the requester's counterpart to the approver's. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Withdrawing can't be undone — confirmed (XC-07). */
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  // Only active types are requestable — the server rejects an archived `type_id` anyway.
  const requestableTypes = types.filter((t) => t.active !== false);

  // Publish the viewer's own leave picture to the assistant (this page is always self-owned).
  useAssistantPageContext({
    facts: [
      { label: "My leave requests", value: String(requests.length) },
      {
        label: "Pending",
        value: String(requests.filter((r) => r.status === "pending").length),
      },
      {
        label: "Approved",
        value: String(requests.filter((r) => r.status === "approved").length),
      },
      { label: "Leave types available", value: String(requestableTypes.length) },
    ],
  });

  const selected = requests.find((r) => r.request_id === selectedId) ?? null;

  const handleCancel = async (id: string) => {
    setWithdrawing(true);
    try {
      await cancel(id);
      toast.success("Request withdrawn");
      setWithdrawId(null);
    } catch {
      toast.error("Couldn't withdraw the request. Try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <PageHeader
        title="Leave"
        description="Request time off and track the status of your leave."
        actions={<RefreshButton onRefresh={leave.reload} refreshing={loading} />}
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
                      {formatDays(b.remaining)}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {formatDays(b.allowance)} days
                      </span>
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDays(b.used)} taken · {formatDays(b.remaining)} available
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
        ) : requests.length === 0 && error ? (
          // A failed read is not "no requests" — under the error banner it used to say "No leave
          // requests yet" as if that were known (QA audit 2026-10-08, WP-113).
          <div className="flex flex-1 items-center justify-center p-5">
            <EmptyState
              icon={TriangleAlert}
              title="Your requests couldn't be loaded"
              description="They're still on file — use Retry above to load them again."
            />
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
                {/* Five columns, not eight. Type/Dates/Days answered one question — "what was
                    asked for" — across three narrow columns, and Status/Submitted split another,
                    which pushed the table past its container into a horizontal scroll. Facts read
                    together are stacked in one cell instead. */}
                <TableHead className="w-[30%] pl-5">Request</TableHead>
                <TableHead className="w-[26%]">Reason</TableHead>
                <TableHead className="w-[22%]">Documents</TableHead>
                <TableHead className="w-[14%]">Status</TableHead>
                <TableHead className="w-[8%] pr-5 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const meta = STATUS_META[r.status] ?? {
                  label: r.status,
                  cls: "bg-muted text-muted-foreground",
                };
                return (
                  <TableRow
                    key={r.request_id}
                    onClick={() => setSelectedId(r.request_id)}
                    className="cursor-pointer"
                  >
                      {/* Type, when, and how long — one question, one cell. The type is a real
                          button, so the detail (full reason, documents) opens by keyboard too —
                          the row's click alone was mouse-only (WP-478). */}
                      <TableCell className="pl-5 align-top">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(r.request_id);
                          }}
                          className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {typeName(r.type_id)}
                        </button>
                        <p className="text-muted-foreground text-sm">
                          {fmtRange(r.from, r.to)}
                          {" · "}
                          {/* A permission shows its window; "0.25 days" means nothing to the
                              person who asked for two hours off. */}
                          {(r.permission_minutes ?? 0) > 0
                            ? `${r.from_time ?? ""}–${r.to_time ?? ""}`
                            : `${r.days} day${r.days === 1 ? "" : "s"}`}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        <span className="line-clamp-2" title={r.reason ?? undefined}>
                          {r.reason ?? "—"}
                        </span>
                      </TableCell>
                    {/* A count, not the filename. The full list — with view and download — is in the dialog
                        this row opens; a name like
                        "How-the-Productivity-Score-Is-Calculated.pdf" swallowed the row. */}
                    <TableCell className="text-muted-foreground align-top">
                      {r.attachments?.length ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-sm"
                          title={r.attachments.map((a) => a.filename).join(", ")}
                        >
                          <Paperclip className="size-3.5" />
                          {r.attachments.length} file{r.attachments.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                      {/* The verdict and when it was asked for: also one question. */}
                      <TableCell className="align-top">
                        <Badge className={cn("font-medium", meta.cls)}>{meta.label}</Badge>
                        <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                          Sent {fmtSubmitted(r.created_at)}
                        </p>
                      </TableCell>
                    <TableCell className="pr-5 text-right align-top">
                      {r.status === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            // The row opens the request; withdrawing must not also open the
                            // drawer for a request that no longer exists (WP-263).
                            e.stopPropagation();
                            setWithdrawId(r.request_id);
                          }}
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



      {/* The same dialog the approver sees. The person who wrote the request could previously only
          read a truncated row of it — the reason clipped, the documents by name only. Footer differs
          (withdraw vs approve/reject); nothing else does. */}
      <LeaveDetailDialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
        detail={
          selected
            ? {
                typeName: typeName(selected.type_id),
                status: (STATUS_META[selected.status]?.label ?? selected.status),
                statusClass: STATUS_META[selected.status]?.cls ?? "bg-muted",
                submittedLabel: `Submitted ${fmtSubmitted(selected.created_at)}`,
                dateLabel: fmtRange(selected.from, selected.to),
                valueLabel:
                  (selected.permission_minutes ?? 0) > 0
                    ? formatMinutes(selected.permission_minutes!)
                    : `${selected.days} day${selected.days === 1 ? "" : "s"}`,
                fromTime: selected.from_time,
                toTime: selected.to_time,
                reason: selected.reason ?? undefined,
                attachments: selected.attachments ?? [],
                resolveUrl: (id) =>
                  getLeaveDocumentUrl(myUserId, selected.request_id, id).then((x) => x.url),
              }
            : null
        }
        footer={
          selected?.status === "pending" ? (
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawId(selected.request_id);
                setSelectedId(null);
              }}
            >
              <X className="size-4" /> Withdraw request
            </Button>
          ) : null
        }
      />

      <RequestLeaveDialog
        open={open}
        onOpenChange={setOpen}
        types={requestableTypes}
        onSubmit={submit}
        balanceFor={balanceFor}
      />

      <ConfirmDialog
        open={withdrawId !== null}
        onOpenChange={(o) => !o && setWithdrawId(null)}
        title="Withdraw this request?"
        description="It leaves your approver's queue. If you still need the time off, you'll have to request it again."
        confirmLabel="Withdraw request"
        destructive
        busy={withdrawing}
        onConfirm={() => withdrawId && void handleCancel(withdrawId)}
      />
    </div>
  );
}
