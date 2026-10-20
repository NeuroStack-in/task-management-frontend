"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarOff,
  Check,
  CheckCheck,
  ClipboardCheck,
  Paperclip,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getLeaveDocumentUrl } from "@/modules/leave/services/leave.service";
import { daysPhrase, formatDays, formatHoursOff } from "@/modules/leave/lib/days";
import { DocumentList } from "@/components/shared/document-list";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TimeCorrectionsQueue } from "./time-corrections-queue";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";
import { useAssistantPageContext } from "@/stores/page-context.store";
import {
  useApprovals,
  type ApprovalItem,
  type BalanceAvailability,
  type BulkFailure,
} from "../use-approvals";
import { decisionError, startsLabel, type BalanceAfter } from "../lib/queue";
import { formatDate, formatDateRange, todayIso } from "@/lib/format";
import { formatWallClock } from "@/modules/attendance/lib/clock";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * Dates and times in the product's one notation, in the viewer's locale (UX audit XC-06 / TIME-14):
 * "13 – 15 Nov 2026", "Sent 20 Jul 2026", and the viewer's own clock — this page hand-built
 * "Nov 13 – Nov 15, 2026", a year-less "Jul 20" and a forced 12-hour "2:30 pm".
 */
const fmtRange = formatDateRange;
const fmtSubmitted = (ms?: number) => (ms ? formatDate(ms) : "—");

/**
 * The big figure: "2 h off" for a few hours (the API's `permission` kind), "3 days" otherwise. It
 * read "Permission" / "0.25 days" — HR jargon and a fraction (UX audit 2026-10-16, TIME-08).
 */
function requestValue(r: { days: number; permissionMinutes?: number }): string {
  const mins = r.permissionMinutes ?? 0;
  if (mins > 0) return formatHoursOff(mins);
  return daysPhrase(r.days);
}

/** "10:30 to 12:30" (the viewer's clock) — what the approver is actually being asked to allow. */
function hoursWindow(r: {
  permissionMinutes?: number;
  fromTime?: string;
  toTime?: string;
}): string | null {
  if ((r.permissionMinutes ?? 0) <= 0 || !r.fromTime || !r.toTime) return null;
  return `${formatWallClock(r.fromTime)} to ${formatWallClock(r.toTime)}`;
}

type Filter = "pending" | "approved" | "rejected" | "cancelled" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export function ApprovalsView() {
  const { can } = usePermissions();
  const canApprove = can("approvals:approve");
  // Time corrections are decided by whoever manages attendance (TIME-05).
  const canDecideTime = can("attendance:edit");
  // Balance-after reads the org ledger, which needs `leave:manage` — the approve bit alone doesn't
  // reach it (TIME-10). Without it the queue says so instead of guessing.
  const canSeeBalances = can("leave:manage");
  const me = useAuthStore((s) => s.user);
  const {
    items,
    counts,
    loading,
    error,
    reload,
    decide,
    approveMany,
    balanceFor,
    balanceAvailability,
    alsoOffFor,
  } = useApprovals({ withBalances: canSeeBalances });
  const today = todayIso();

  const [filter, setFilter] = useState<Filter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Every request with a decision in flight. A single id let row A's buttons re-enable the moment
  // row B was clicked, while A was still being decided (QA audit 2026-10-08, WP-482).
  const [deciding, setDeciding] = useState<ReadonlySet<string>>(new Set());
  /**
   * Reject is confirmed — it is final, and the person is told (XC-07 / TIME-10). Approve stays one
   * click: it is the expected outcome, and the employee can still cancel leave that hasn't started.
   */
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  /** Optional note for the requester — shown on their request and in the notification. */
  const [rejectReason, setRejectReason] = useState("");
  /** Requests ticked for bulk approval (TIME-10), by id. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDone, setBulkDone] = useState<number | null>(null);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);

  const rows = useMemo(
    () => items.filter((a) => filter === "all" || a.status === filter),
    [items, filter],
  );

  /**
   * Who may be ticked: a pending request the viewer can decide. An approver's own leave is refused
   * by the server unless they're the owner (`cannot_approve_own_request`), so it isn't offered.
   */
  const selectable = (r: ApprovalItem) =>
    canApprove && r.status === "pending" && (Boolean(me?.isOwner) || r.userId !== me?.id);
  const selectableRows = rows.filter(selectable);
  // Only what is still on screen and still pending counts — a decided or filtered-away request
  // drops out of the selection by itself.
  const chosen = selectableRows.filter((r) => picked.has(r.requestId));
  const allChosen = selectableRows.length > 0 && chosen.length === selectableRows.length;

  const togglePick = (id: string, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const selected = items.find((a) => a.requestId === selectedId) ?? null;
  const showActions = canApprove && rows.some((r) => r.status === "pending");
  const showPick = selectableRows.length > 0;
  // The queue couldn't be read and there is nothing on hand: every count and the "Nothing to review"
  // state would be statements about data the page doesn't have (QA audit 2026-10-08, WP-113).
  const failed = Boolean(error) && items.length === 0;

  // Publish the approval queue's counts + active filter to the assistant.
  useAssistantPageContext({
    facts: failed
      ? [{ label: "Approval queue", value: "couldn't be loaded" }]
      : [
          { label: "Pending", value: String(counts.pending ?? 0) },
          { label: "Approved", value: String(counts.approved ?? 0) },
          { label: "Rejected", value: String(counts.rejected ?? 0) },
          { label: "Cancelled", value: String(counts.cancelled ?? 0) },
          { label: "Filter", value: filter },
          { label: "Showing", value: String(rows.length) },
        ],
  });

  const runDecide = async (
    item: ApprovalItem,
    decision: "approve" | "reject",
    reason?: string,
  ) => {
    setDeciding((s) => new Set(s).add(item.requestId));
    try {
      await decide(item, decision, reason);
      setSelectedId(null);
      toast.success(decision === "approve" ? "Request approved" : "Request rejected", {
        description: `${item.typeName} · ${item.requesterName}`,
      });
    } catch (e) {
      // Each failure needs its own next step, and "try again" is right for none of them (WP-262).
      const { title, description, stale } = decisionError(e, item);
      toast.error(title, { description });
      if (stale) {
        setSelectedId(null);
        reload();
      }
    } finally {
      setDeciding((s) => {
        const next = new Set(s);
        next.delete(item.requestId);
        return next;
      });
    }
  };

  const runBulk = async () => {
    const batch = chosen;
    if (batch.length === 0) return;
    setBulkDone(0);
    setBulkFailures([]);
    const { approved, failed: failures } = await approveMany(batch, setBulkDone);
    setBulkDone(null);
    setBulkOpen(false);
    // The ones that went through leave the selection; the ones that didn't stay ticked, listed
    // below with why, so they can be fixed or rejected one by one.
    setPicked(new Set(failures.map((f) => f.item.requestId)));
    setBulkFailures(failures);
    if (failures.length === 0) {
      toast.success(`${approved.length} request${approved.length === 1 ? "" : "s"} approved`);
    } else {
      toast.error(
        `${approved.length} approved · ${failures.length} couldn't be`,
        { description: "The ones that failed are listed above the queue, with why." },
      );
    }
  };

  const renderSummary = (req: ApprovalItem, compact: boolean) => (
    <RequestSummary
      req={req}
      today={today}
      balance={balanceFor(req)}
      alsoOff={req.status === "pending" ? alsoOffFor(req) : []}
      compact={compact}
    />
  );

  return (
    // No bottom padding of its own: the shell reserves the assistant button's room (XC-03).
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        description={
          failed
            ? "Review and decide time-off requests and time corrections"
            : `${counts.pending ?? 0} leave pending · review and decide time-off requests and time corrections`
        }
        actions={<RefreshButton onRefresh={reload} refreshing={loading} />}
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

      {canDecideTime ? <TimeCorrectionsQueue /> : null}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
            )}
          >
            {f.label} · {failed ? "—" : (counts[f.value] ?? 0)}
          </button>
        ))}
      </div>

      {/* Why balance-after is missing, said once rather than as a blank on every row. */}
      {!failed && (counts.pending ?? 0) > 0 && balanceAvailability !== "ok" && balanceAvailability !== "loading" ? (
        <p className="text-muted-foreground text-xs">
          {balanceAvailability === "error"
            ? "Leave balances couldn't be loaded, so each request's balance after approval isn't shown. The balance is still checked when you approve."
            : "Balances after approval need the “Manage leave types & allowances” permission, which your role doesn't have. The balance is still checked when you approve."}
        </p>
      ) : null}

      {/* Bulk approval (TIME-10): tick, then one confirmed action. Shown only when something on
          screen can be ticked. */}
      {showPick ? (
        <div className="bg-card shadow-soft flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allChosen}
              indeterminate={chosen.length > 0 && !allChosen}
              onCheckedChange={(on) =>
                setPicked(on ? new Set(selectableRows.map((r) => r.requestId)) : new Set())
              }
              aria-label="Select every pending request on screen"
            />
            {chosen.length > 0
              ? `${chosen.length} selected`
              : `Select all pending (${selectableRows.length})`}
          </label>
          {chosen.length > 0 ? (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                <CheckCheck className="size-4" /> Approve {chosen.length}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {bulkFailures.length ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 space-y-2 rounded-xl border px-4 py-3 text-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">
              {bulkFailures.length} request{bulkFailures.length === 1 ? "" : "s"} couldn&apos;t be
              approved
            </p>
            <Button variant="ghost" size="sm" className="-my-1 h-7" onClick={() => setBulkFailures([])}>
              Dismiss
            </Button>
          </div>
          <ul className="space-y-1.5">
            {bulkFailures.map((f) => (
              <li key={f.item.requestId}>
                <span className="font-medium">{f.item.requesterName}</span>{" "}
                <span className="text-muted-foreground">
                  · {f.item.typeName}, {fmtRange(f.item.from, f.item.to)}
                </span>
                <br />
                <span className="text-destructive">{f.title}.</span>{" "}
                <span className="text-muted-foreground">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <Card className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </Card>
      ) : failed ? (
        <EmptyState
          icon={TriangleAlert}
          title="The approval queue couldn't be loaded"
          description="Requests waiting for a decision are still on file — use Retry above to load them."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to review"
          description="No requests in this view. Try another status filter."
        />
      ) : (
        <Card className="p-0 [--card-spacing:0px]">
          {/* Phones: a card per request with its decision buttons inside it. The table hid Status
              and the approve/reject buttons past the right edge (UX audit 2026-10-16, TIME-12). */}
          <ul className="divide-y divide-border sm:hidden" aria-label="Leave requests">
            {rows.map((req) => (
              <li key={req.requestId} className="space-y-2.5 px-4 py-4">
                <div className="flex items-start gap-3">
                  {showPick ? (
                    <span className="pt-1.5">
                      <Checkbox
                        checked={picked.has(req.requestId)}
                        disabled={!selectable(req)}
                        onCheckedChange={(on) => togglePick(req.requestId, on)}
                        aria-label={`Select ${req.requesterName}'s ${req.typeName} request`}
                      />
                    </span>
                  ) : null}
                  <UserAvatar
                    userId={req.userId}
                    name={req.requesterName}
                    className="size-8 shrink-0"
                    fallbackClassName="text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedId(req.requestId)}
                      className="text-left font-medium break-words hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {req.requesterName}
                    </button>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      Sent {fmtSubmitted(req.createdAt)}
                    </p>
                  </div>
                  <Badge className={cn("shrink-0 border-0 capitalize", STATUS_BADGE[req.status] ?? "bg-muted")}>
                    {req.status}
                  </Badge>
                </div>
                {renderSummary(req, true)}
                {req.reason ? (
                  <p className="line-clamp-2 text-sm break-words text-muted-foreground">{req.reason}</p>
                ) : null}
                {req.attachments.length ? (
                  <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Paperclip className="size-3" />
                    {req.attachments.length} file{req.attachments.length === 1 ? "" : "s"}
                  </p>
                ) : null}
                {canApprove && req.status === "pending" ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deciding.has(req.requestId)}
                      onClick={() => setRejectTarget(req)}
                      aria-label={`Reject ${req.requesterName}'s ${req.typeName} request`}
                    >
                      <X className="size-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={deciding.has(req.requestId)}
                      onClick={() => void runDecide(req, "approve")}
                      aria-label={`Approve ${req.requesterName}'s ${req.typeName} request`}
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
            <Table
              scrollLabel="Leave requests"
              className="min-w-[900px] table-fixed [&_td]:px-4 [&_th]:px-4"
            >
              <TableHeader>
                <TableRow>
                  {showPick ? (
                    <TableHead className="w-10">
                      <span className="sr-only">Select</span>
                    </TableHead>
                  ) : null}
                  {/* Same shape as the employee's "My requests": Request / Reason / Documents /
                      Status, with Requester in front because this queue spans people. Type, dates
                      and duration were three columns answering one question. Stacked in one cell it
                      fits and reads in order — now with the balance it leaves and who else is off. */}
                  <TableHead className="w-[19%]">Requester</TableHead>
                  <TableHead className="w-[33%]">Request</TableHead>
                  <TableHead className="w-[18%]">Reason</TableHead>
                  <TableHead className="w-[10%]">Documents</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  {showActions ? (
                    <TableHead className="w-[9%] text-right">Actions</TableHead>
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
                    {showPick ? (
                      <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                        <span className="flex pt-1">
                          <Checkbox
                            checked={picked.has(req.requestId)}
                            disabled={!selectable(req)}
                            onCheckedChange={(on) => togglePick(req.requestId, on)}
                            aria-label={`Select ${req.requesterName}'s ${req.typeName} request`}
                          />
                        </span>
                      </TableCell>
                    ) : null}
                    <TableCell className="align-top">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar
                          userId={req.userId}
                          name={req.requesterName}
                          className="size-7 shrink-0"
                          fallbackClassName="text-[10px]"
                        />
                        {/* A real button, so the request (full reason, documents) opens by keyboard
                            too — the row's click alone was mouse-only (WP-478). */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(req.requestId);
                          }}
                          aria-label={`Open ${req.requesterName}'s ${req.typeName} request`}
                          className="min-w-0 truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {req.requesterName}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      {renderSummary(req, true)}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top whitespace-normal">
                      <span className="line-clamp-2 break-words" title={req.reason ?? undefined}>
                        {req.reason ?? "—"}
                      </span>
                    </TableCell>
                    {/* A count, not the filename: the full list (with view/download) is in the dialog
                        this row opens, and a long filename swallowed the row. */}
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
                      <TableCell className="text-right align-top">
                        {req.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-success hover:text-success"
                              aria-label={`Approve ${req.requesterName}'s ${req.typeName} request`}
                              title="Approve"
                              disabled={deciding.has(req.requestId)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void runDecide(req, "approve");
                              }}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:text-destructive"
                              aria-label={`Reject ${req.requesterName}'s ${req.typeName} request`}
                              title="Reject"
                              disabled={deciding.has(req.requestId)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectTarget(req);
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
        busy={selected ? deciding.has(selected.requestId) : false}
        today={today}
        balance={selected ? balanceFor(selected) : null}
        balanceAvailability={balanceAvailability}
        alsoOff={selected && selected.status === "pending" ? alsoOffFor(selected) : []}
        onClose={() => setSelectedId(null)}
        onDecide={(req, decision) =>
          decision === "reject" ? setRejectTarget(req) : void runDecide(req, decision)
        }
      />

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
        title={`Reject ${rejectTarget?.requesterName ?? "this"}'s request?`}
        description={
          rejectTarget
            ? `${rejectTarget.typeName}, ${fmtRange(rejectTarget.from, rejectTarget.to)} · ${requestValue(rejectTarget)}. A rejected request can't be reopened — they would have to ask again. They're notified, with your note if you add one.`
            : ""
        }
        confirmLabel="Reject request"
        destructive
        busy={rejectTarget ? deciding.has(rejectTarget.requestId) : false}
        onConfirm={async () => {
          if (!rejectTarget) return;
          const t = rejectTarget;
          await runDecide(t, "reject", rejectReason);
          setRejectTarget(null);
          setRejectReason("");
        }}
      >
        {/* The reason reaches them now — on their request and in the notification (TIME-10). */}
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          maxLength={500}
          aria-label="Note for the employee (optional)"
          placeholder="Note for them (optional) — e.g. two others are already off that week."
          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </ConfirmDialog>

      {/* Bulk approve, confirmed with the count and the list (TIME-10). Each one goes through the
          same decide route as a single click, one after another, and failures are reported per
          request — nothing is approved that the server wouldn't approve on its own. */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={(o) => !o && bulkDone === null && setBulkOpen(false)}
        title={`Approve ${chosen.length} leave request${chosen.length === 1 ? "" : "s"}?`}
        description="Each is approved in turn: the days come off that person's balance, show as leave in attendance, and they're notified. Any the server refuses — not enough balance, an overlap — stay pending and are listed afterwards."
        confirmLabel={
          bulkDone !== null ? `Approving ${bulkDone} of ${chosen.length}…` : `Approve ${chosen.length}`
        }
        busy={bulkDone !== null}
        confirmDisabled={chosen.length === 0}
        onConfirm={() => void runBulk()}
      >
        <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border px-3 py-2 text-sm">
          {chosen.map((r) => {
            const short = (balanceFor(r) ?? []).some((b) => b?.over);
            return (
              <li key={r.requestId} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="min-w-0">
                  <span className="font-medium">{r.requesterName}</span>{" "}
                  <span className="text-muted-foreground">
                    · {r.typeName}, {fmtRange(r.from, r.to)} · {requestValue(r)}
                  </span>
                </span>
                {short ? (
                  <span className="text-destructive text-xs">Not enough balance — will fail</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}

/**
 * What was asked for, and what an approver needs beside it (TIME-10): when it starts, what it leaves
 * the person with, and who else is off on those dates. `compact` keeps it to one line each for the
 * list; the dialog spells everything out.
 */
function RequestSummary({
  req,
  today,
  balance,
  alsoOff,
  compact,
}: {
  req: ApprovalItem;
  today: string;
  balance: (BalanceAfter | null)[] | null;
  alsoOff: ApprovalItem[];
  compact: boolean;
}) {
  const starts = req.status === "pending" ? startsLabel(req.from, today) : null;
  const soon = req.status === "pending" && /today|tomorrow|Started/.test(starts ?? "");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="gap-1">
          <CalendarOff className="size-3" />
          {req.typeName}
        </Badge>
        {starts ? (
          <span className={cn("text-xs font-medium", soon ? "text-warning" : "text-muted-foreground")}>
            {starts}
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {fmtRange(req.from, req.to)} · {requestValue(req)}
      </p>
      {hoursWindow(req) ? (
        <p className="text-muted-foreground text-sm">{hoursWindow(req)}</p>
      ) : null}
      {balance ? <BalanceLines rows={balance} typeName={req.typeName} compact={compact} /> : null}
      {alsoOff.length ? <AlsoOffLine others={alsoOff} req={req} /> : null}
    </div>
  );
}

/** "Balance after: 9 of 20 days" — or why approving will fail, or that the type has no quota. */
function BalanceLines({
  rows,
  typeName,
  compact,
}: {
  rows: (BalanceAfter | null)[];
  typeName: string;
  compact: boolean;
}) {
  const multiYear = rows.length > 1;
  return (
    <>
      {rows.map((b, i) => {
        if (!b) {
          return compact ? null : (
            <p key={i} className="text-muted-foreground text-sm">
              That year&apos;s balance isn&apos;t known yet — it&apos;s checked when you approve.
            </p>
          );
        }
        const prefix = multiYear ? `${b.year}: ` : "";
        if (b.allowance <= 0) {
          return (
            <p key={b.year} className="text-muted-foreground text-xs">
              {prefix}No fixed allowance for {typeName}
            </p>
          );
        }
        if (b.over) {
          return (
            <p key={b.year} className="text-destructive text-xs font-medium">
              {prefix}Only {daysPhrase(Math.max(0, b.left))} of {typeName} left — approving will fail
            </p>
          );
        }
        return (
          <p key={b.year} className="text-xs">
            <span className="text-muted-foreground">{prefix}Balance after:</span>{" "}
            <span className="font-medium tabular-nums">
              {formatDays(b.after)} of {formatDays(b.allowance)} days
            </span>
            {b.otherPending > 0 ? (
              <span className="text-warning">
                {" "}
                · {daysPhrase(b.otherPending)} more pending
              </span>
            ) : null}
          </p>
        );
      })}
    </>
  );
}

/** "Also off: Priya S, Sam K +2" — who else is away on any of these dates. */
function AlsoOffLine({ others, req }: { others: ApprovalItem[]; req: ApprovalItem }) {
  const names = [...new Set(others.map((o) => o.requesterName))];
  const sameDept = req.department
    ? others.filter((o) => o.department === req.department).length
    : 0;
  const shown = names.slice(0, 2).join(", ");
  const full = others.map((o) => `${o.requesterName} · ${fmtRange(o.from, o.to)} (${o.status})`);
  return (
    <p className="text-muted-foreground flex items-start gap-1 text-xs" title={full.join("\n")}>
      <Users className="mt-px size-3 shrink-0" />
      {/* The "+2" hid its names, and every date, in the tooltip alone. A screen reader gets the full
          list (TIME-15); the request's dialog spells it out for everyone. */}
      <span aria-hidden="true">
        Also off: {shown}
        {names.length > 2 ? ` +${names.length - 2}` : ""}
        {sameDept > 0 ? ` · ${sameDept} in ${req.department}` : ""}
      </span>
      <span className="sr-only">
        Also off: {full.join("; ")}
        {sameDept > 0 ? `. ${sameDept} in ${req.department}` : ""}
      </span>
    </p>
  );
}

function ApprovalDialog({
  request: req,
  canApprove,
  busy,
  today,
  balance,
  balanceAvailability,
  alsoOff,
  onClose,
  onDecide,
}: {
  request: ApprovalItem | null;
  canApprove: boolean;
  busy: boolean;
  today: string;
  balance: (BalanceAfter | null)[] | null;
  balanceAvailability: BalanceAvailability;
  alsoOff: ApprovalItem[];
  onClose: () => void;
  onDecide: (req: ApprovalItem, decision: "approve" | "reject") => void;
}) {
  const initialFocusRef = useRef<HTMLDivElement>(null);
  const starts = req && req.status === "pending" ? startsLabel(req.from, today) : null;
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
              <DialogDescription>
                Submitted {fmtSubmitted(req.createdAt)}
                {starts ? ` · ${starts}` : ""}
              </DialogDescription>
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
                  {req.department ? ` · ${req.department}` : ""}
                </p>
                {/* The one thing an approver of a few hours off decides on: which hours the person
                    will be away. "0.25 days" said none of it, and "permission" is HR jargon. */}
                {hoursWindow(req) ? (
                  <p className="text-foreground truncate text-sm">Away from {hoursWindow(req)}</p>
                ) : null}
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {requestValue(req)}
              </span>
            </div>

            {req.status === "pending" ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Balance
                </p>
                {balance ? (
                  <div className="space-y-1 text-sm">
                    {balance.map((b, i) =>
                      !b ? (
                        <p key={i} className="text-muted-foreground">
                          That year&apos;s balance isn&apos;t known yet — it&apos;s checked when you
                          approve.
                        </p>
                      ) : b.allowance <= 0 ? (
                        <p key={b.year} className="text-muted-foreground">
                          {req.typeName} has no fixed allowance — nothing comes off a quota.
                        </p>
                      ) : (
                        <p key={b.year}>
                          {req.typeName} · {b.year}:{" "}
                          <span className="font-medium">{daysPhrase(Math.max(0, b.left))} left</span>
                          {b.over ? (
                            <span className="text-destructive">
                              {" "}
                              — this needs {formatDays(b.share)}, so approving will fail. Reject it,
                              or raise their allowance under Leave first.
                            </span>
                          ) : (
                            <>
                              {" "}
                              → <span className="font-medium">{formatDays(b.after)}</span> after
                              approving
                            </>
                          )}
                          {b.otherPending > 0 ? (
                            <span className="text-warning block text-xs">
                              {daysPhrase(b.otherPending)} of {req.typeName} also waiting in their
                              other requests.
                            </span>
                          ) : null}
                        </p>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {balanceAvailability === "forbidden" || balanceAvailability === "off"
                      ? "Not shown — balances need the “Manage leave types & allowances” permission. The server still checks the balance when you approve."
                      : balanceAvailability === "loading"
                        ? "Loading…"
                        : "Couldn't load balances. The server still checks the balance when you approve."}
                  </p>
                )}
              </div>
            ) : null}

            {req.status === "pending" ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Also off on these dates
                </p>
                {alsoOff.length ? (
                  <ul className="space-y-1 text-sm">
                    {alsoOff.map((o) => (
                      <li key={o.requestId} className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="font-medium">{o.requesterName}</span>
                        <span className="text-muted-foreground">
                          · {fmtRange(o.from, o.to)} · {requestValue(o)}
                          {o.status === "pending" ? " · not decided yet" : ""}
                        </span>
                        {req.department && o.department === req.department ? (
                          <Badge variant="secondary" className="font-normal">
                            Same department
                          </Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nobody else has approved or pending leave on these dates.
                  </p>
                )}
              </div>
            ) : null}

            {req.reason ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p className="text-sm leading-relaxed break-words">{req.reason}</p>
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
                  {/* Named for the person, like the list's buttons (UX audit 2026-10-16, TIME-15). */}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => onDecide(req, "reject")}
                    aria-label={`Reject ${req.requesterName}'s ${req.typeName} request`}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => onDecide(req, "approve")}
                    aria-label={`Approve ${req.requesterName}'s ${req.typeName} request`}
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                </>
              ) : null}
              {/* No "view-only" branch: the queue route needs `LeaveApprove`, which grants both
                  `approvals:view` and `approvals:approve` — nobody can read this page without being
                  able to decide on it (WP-480). */}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
