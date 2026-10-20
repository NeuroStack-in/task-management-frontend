"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, CalendarX2, Paperclip, Plane, TriangleAlert, X } from "lucide-react";
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
import { daysPhrase, formatDays, formatHoursOff } from "../lib/days";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  RequestLeaveDialog,
  type BalanceLookup,
} from "./request-leave-dialog";
import { workingPortions } from "../lib/working-days";
import { useWorkCalendar } from "../use-work-calendar";
import { RecordLeaveButton } from "./record-leave-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LeaveTypesManager } from "./leave-types-manager";
import { LeaveDetailDialog, fmt12 } from "./leave-detail-dialog";
import { useAuthStore } from "@/stores/auth.store";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { getLeaveDocumentUrl, type ApiLeaveRequest } from "../services/leave.service";
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

/** Minutes of a few-hours request (the API's `permission` kind), else 0 for a full day. */
const hoursOffMinutes = (r: ApiLeaveRequest) => r.permission_minutes ?? 0;

/**
 * How long a request is, in the words its author would use: "2 h off" for a few hours (UX audit
 * 2026-10-16, TIME-08 — it read "Permission" / "0.25 days"), "3 days" for whole days.
 */
const requestAmount = (r: ApiLeaveRequest) =>
  hoursOffMinutes(r) > 0 ? formatHoursOff(hoursOffMinutes(r)) : daysPhrase(r.days);

/** "Nov 13, 2026 · 2 h off · 10:30 am – 12:30 pm", or "Nov 13 – Nov 15, 2026 · 3 days". */
const requestWhen = (r: ApiLeaveRequest) => {
  const window =
    hoursOffMinutes(r) > 0 && r.from_time && r.to_time
      ? ` · ${fmt12(r.from_time)} – ${fmt12(r.to_time)}`
      : "";
  return `${fmtRange(r.from, r.to)} · ${requestAmount(r)}${window}`;
};

/**
 * Approved leave the requester may still cancel: the server allows it until the leave starts and
 * credits the days back (`cancel_leave`, compared in UTC days — see TIME-09 below).
 */
const cancellable = (r: ApiLeaveRequest, today: string) =>
  r.status === "approved" && r.from >= today;

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
    // Bottom room for the floating assistant button, so it never sits on the last control
    // (UX audit 2026-10-16, TIME-12 / XC-03).
    <div className="flex min-h-full flex-col gap-5 pb-20">
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

/** What the confirm dialog is about to do — withdraw a pending request, or cancel approved leave. */
type Pending = { request: ApiLeaveRequest; mode: "withdraw" | "cancel" };

function EmployeeLeaveView() {
  const { can } = usePermissions();
  // The download route is keyed by owner, and on this page the owner is always the viewer.
  const myUserId = useAuthStore((st) => st.user?.id ?? "");
  const leave = useLeave();
  const { balances, balanceYear, requests, types, typeName, loading, error, submit, cancel } = leave;
  // What the request dialog shows against the balance (TIME-07): the server's figures for the loaded
  // year, plus the days this person already has waiting in that type and year.
  const calendar = useWorkCalendar();
  const balanceFor = useMemo<BalanceLookup>(
    () => (typeId, year) => {
      if (year !== balanceYear) return null;
      const b = balances.find((x) => x.type_id === typeId);
      if (!b) return null;
      const pending = requests
        .filter((r) => r.status === "pending" && r.type_id === typeId)
        .reduce(
          (sum, r) =>
            sum +
            (workingPortions(r.from, r.to, r.days, calendar).find(([y]) => y === year)?.[1] ?? 0),
          0,
        );
      return { allowance: b.allowance, used: b.used, pending };
    },
    [balances, balanceYear, requests, calendar],
  );
  const [open, setOpen] = useState(false);
  /** The request whose detail dialog is open — the requester's counterpart to the approver's. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Withdrawing and cancelling can't be undone — both are confirmed (XC-07, TIME-09). */
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  // Only active types are requestable — the server rejects an archived `type_id` anyway.
  const requestableTypes = types.filter((t) => t.active !== false);
  // The local day, for "has this leave started yet?". The server compares in UTC days, which leaves
  // about a day of slack either side; a refusal from it is handled below, not guessed at here.
  const today = todayIso();

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

  const runConfirmed = async ({ request: r, mode }: Pending) => {
    setBusy(true);
    try {
      await cancel(r.request_id);
      if (mode === "withdraw") {
        toast.success("Request withdrawn");
      } else {
        toast.success("Leave cancelled", {
          description: `${requestAmount(r)} back in your ${typeName(r.type_id)} balance.`,
        });
      }
      setConfirming(null);
    } catch (e) {
      // The server is the judge of "already started" — it compares in UTC days, so near a local
      // midnight it can disagree with the button that offered this (TIME-09).
      const code = e instanceof ApiError ? (e.code ?? "") : "";
      if (code === "leave_already_started") {
        toast.error("This leave has already started", {
          description:
            "Leave can only be cancelled before its first day. Ask an admin to correct your attendance or balance.",
        });
        setConfirming(null);
        leave.reload();
      } else if (code === "cannot_cancel" || (e instanceof ApiError && e.status === 409)) {
        toast.error("This request can't be changed any more", {
          description: "It was decided or cancelled elsewhere — the list has been refreshed.",
        });
        setConfirming(null);
        leave.reload();
      } else {
        toast.error(
          friendlyError(
            e,
            mode === "withdraw"
              ? "Couldn't withdraw the request. Try again."
              : "Couldn't cancel the leave. Try again.",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  /** The row's one action, if it has one — the same button in the table and the phone card. */
  const actionFor = (r: ApiLeaveRequest, className?: string) =>
    r.status === "pending" ? (
      <Button
        variant="ghost"
        size="sm"
        className={className}
        aria-label={`Withdraw your ${typeName(r.type_id)} request for ${fmtRange(r.from, r.to)}`}
        onClick={(e) => {
          // The row opens the request; withdrawing must not also open the drawer for a request
          // that no longer exists (WP-263).
          e.stopPropagation();
          setConfirming({ request: r, mode: "withdraw" });
        }}
      >
        <X className="size-4" /> Withdraw
      </Button>
    ) : cancellable(r, today) ? (
      <Button
        variant="ghost"
        size="sm"
        className={className}
        aria-label={`Cancel your approved ${typeName(r.type_id)} for ${fmtRange(r.from, r.to)}`}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming({ request: r, mode: "cancel" });
        }}
      >
        <CalendarX2 className="size-4" /> Cancel leave
      </Button>
    ) : null;

  return (
    // Bottom room for the floating assistant button (UX audit 2026-10-16, TIME-12 / XC-03).
    <div className="flex min-h-full flex-col gap-5 pb-20">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
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
          <>
            {/* Phones: one card per request, its action inside it. The table below cut Status and
                Withdraw off past the right edge of a 390 px screen, behind a sideways scroll nothing
                pointed to (UX audit 2026-10-16, TIME-12 / XC-05). */}
            <ul className="divide-y divide-border sm:hidden" aria-label="My leave requests">
              {requests.map((r) => {
                const meta = STATUS_META[r.status] ?? {
                  label: r.status,
                  cls: "bg-muted text-muted-foreground",
                };
                const action = actionFor(r, "w-full justify-center border");
                return (
                  <li key={r.request_id} className="space-y-2 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.request_id)}
                        className="min-w-0 text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {typeName(r.type_id)}
                      </button>
                      <Badge className={cn("shrink-0 font-medium", meta.cls)}>{meta.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{requestWhen(r)}</p>
                    {r.reason ? (
                      <p className="line-clamp-2 text-sm break-words">{r.reason}</p>
                    ) : null}
                    {r.status === "rejected" && r.decision_reason ? (
                      <p className="text-destructive line-clamp-2 text-sm break-words">
                        Not approved: {r.decision_reason}
                      </p>
                    ) : null}
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">Sent {fmtSubmitted(r.created_at)}</span>
                      {r.attachments?.length ? (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="size-3" />
                          {r.attachments.length} file{r.attachments.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </p>
                    {action ? <div className="pt-1">{action}</div> : null}
                  </li>
                );
              })}
            </ul>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Five columns, not eight. Type/Dates/Days answered one question — "what was
                        asked for" — across three narrow columns, and Status/Submitted split another,
                        which pushed the table past its container into a horizontal scroll. Facts read
                        together are stacked in one cell instead. */}
                    <TableHead className="w-[30%] pl-5">Request</TableHead>
                    <TableHead className="w-[24%]">Reason</TableHead>
                    <TableHead className="w-[16%]">Documents</TableHead>
                    <TableHead className="w-[14%]">Status</TableHead>
                    <TableHead className="w-[16%] pr-5 text-right">Action</TableHead>
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
                        <TableCell className="pl-5 align-top whitespace-normal">
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
                          <p className="text-muted-foreground text-sm">{requestWhen(r)}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground align-top whitespace-normal">
                          <span className="line-clamp-2 break-words" title={r.reason ?? undefined}>
                            {r.reason ?? "—"}
                          </span>
                          {r.status === "rejected" && r.decision_reason ? (
                            <span className="text-destructive mt-1 line-clamp-2 block break-words text-xs">
                              Not approved: {r.decision_reason}
                            </span>
                          ) : null}
                        </TableCell>
                        {/* A count, not the filename. The full list — with view and download — is in
                            the dialog this row opens; a name like
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
                          {actionFor(r) ?? <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* The same dialog the approver sees. The person who wrote the request could previously only
          read a truncated row of it — the reason clipped, the documents by name only. Footer differs
          (withdraw / cancel vs approve/reject); nothing else does. */}
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
                valueLabel: requestAmount(selected),
                fromTime: selected.from_time,
                toTime: selected.to_time,
                reason: selected.reason ?? undefined,
                decisionReason:
                  selected.status === "rejected" ? selected.decision_reason : undefined,
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
                setConfirming({ request: selected, mode: "withdraw" });
                setSelectedId(null);
              }}
            >
              <X className="size-4" /> Withdraw request
            </Button>
          ) : selected && cancellable(selected, today) ? (
            <Button
              variant="outline"
              onClick={() => {
                setConfirming({ request: selected, mode: "cancel" });
                setSelectedId(null);
              }}
            >
              <CalendarX2 className="size-4" /> Cancel leave
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
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming?.mode === "cancel" ? "Cancel this leave?" : "Withdraw this request?"}
        description={
          confirming?.mode === "cancel" ? (
            // Said exactly as `cancel_leave` does it (UX audit 2026-10-16, TIME-09): the days are
            // credited back in the same transaction, `leave.cancelled` un-marks the days in
            // attendance, and the only notification goes to the requester (plus a Slack channel
            // post where the org routes one) — no approver is notified, so we don't claim one is.
            <>
              {typeName(confirming.request.type_id)}, {requestWhen(confirming.request)}.{" "}
              {hoursOffMinutes(confirming.request) > 0
                ? `The ${daysPhrase(confirming.request.days)} goes back to your balance and those hours stop counting as leave.`
                : `The ${daysPhrase(confirming.request.days)} go back to your balance and those days stop counting as leave in attendance.`}{" "}
              WorkPulse doesn&apos;t notify your approver directly, so let them know. To take the
              time off again later, you&apos;ll need a new request.
            </>
          ) : (
            "It leaves your approver's queue. If you still need the time off, you'll have to request it again."
          )
        }
        confirmLabel={confirming?.mode === "cancel" ? "Cancel leave" : "Withdraw request"}
        cancelLabel={confirming?.mode === "cancel" ? "Keep leave" : "Cancel"}
        destructive
        busy={busy}
        onConfirm={() => confirming && void runConfirmed(confirming)}
      />
    </div>
  );
}
