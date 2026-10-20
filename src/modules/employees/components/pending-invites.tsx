"use client";

/**
 * "Invited" — the people who've been sent an invite but haven't joined yet.
 *
 * This is the home for **Resend** and **Revoke**. They used to live on the post-create dialog, which
 * meant they were reachable for about ten seconds and then never again; an invite you need to fix is
 * almost always one you created yesterday, so the actions belong on a list you can come back to.
 *
 * The section hides itself when the org has no invites at all — a permanently empty table between
 * the stat cards and the employee list is noise for the many orgs that invite once and never again.
 * A failed read is not "no invites", though: it shows, with Retry (UX audit PEOPLE-10).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MailCheck, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate, formatDateTime, UNKNOWN_DEPARTMENT, UNKNOWN_ROLE } from "@/lib/format";
import { TablePagination } from "@/components/shared/table-pagination";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  listInvites,
  listDepartments,
  resendInvite,
  revokeInvite,
  type ApiDepartment,
  type ApiInvite,
} from "../services/employees.service";

/**
 * The most invites `GET /v1/employees/invites` returns (`list_invites::data` walks every page up to
 * this). At this size the list may be missing some.
 */
const SERVER_LIST_CAP = 20_000;

/** A queued email with no outcome after this long never got an answer — say so, not "Sending…". */
const SEND_GRACE_MS = 15 * 60_000;

/**
 * The invite email's state, said plainly (UX audit PEOPLE-07). Invites were reported "sent" whatever
 * happened, so a batch past the provider's daily limit vanished: the invite existed, the email never
 * left, and nothing on screen said so.
 */
function emailMeta(
  invite: ApiInvite,
  nowMs: number,
): { label: string; tone: string; hint?: string; failed?: boolean } | null {
  switch (invite.email_status) {
    case "sent":
      return {
        label: "Sent",
        tone: "text-success",
        hint: invite.email_at
          ? `Accepted by the email provider ${formatDateTime(invite.email_at)}`
          : undefined,
      };
    case "not_emailed":
      return {
        label: "Not emailed",
        tone: "text-muted-foreground",
        hint: "Created for the downloaded spreadsheet — the code is handed out, not emailed.",
      };
    case "queued": {
      const since = invite.email_requested_at ?? invite.created_at;
      return since && nowMs - since > SEND_GRACE_MS
        ? {
            label: "Not confirmed",
            tone: "text-warning",
            hint: "No answer from the email provider. Send a new invite if they haven't received it.",
            failed: true,
          }
        : { label: "Sending…", tone: "text-muted-foreground" };
    }
    case "failed":
      switch (invite.email_reason) {
        case "daily_limit":
          return {
            label: "Not sent — daily email limit",
            tone: "text-destructive",
            hint: "The email provider's daily limit was reached. Resend tomorrow, or hand the code out with Create + download Excel.",
            failed: true,
          };
        case "rate_limited":
          return {
            label: "Not sent — too many at once",
            tone: "text-destructive",
            hint: "Sent in a burst the email provider refused. Resending this one should work.",
            failed: true,
          };
        default:
          return {
            label: "Not sent",
            tone: "text-destructive",
            hint: "The email didn't go out. Check the address, then resend.",
            failed: true,
          };
      }
    default:
      return null;
  }
}

/** `pending` past its expiry is expired — the server expires lazily, so status alone under-reports. */
type Derived = "pending" | "locked" | "expired" | "revoked" | "accepted";

function derive(invite: ApiInvite, nowSecs: number): Derived {
  if (invite.status === "revoked") return "revoked";
  if (invite.status === "accepted") return "accepted";
  // Five wrong codes lock an invite. It used to read "Awaiting acceptance" here while the server
  // refused both Resend and Revoke on it; both now work on a locked invite (WP-048).
  if (invite.status === "locked") return "locked";
  return invite.expires_at > 0 && invite.expires_at < nowSecs ? "expired" : "pending";
}

const STATUS_META: Record<
  Derived,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Awaiting acceptance", variant: "default" },
  locked: { label: "Locked — too many wrong codes", variant: "destructive" },
  expired: { label: "Expired", variant: "outline" },
  revoked: { label: "Revoked", variant: "destructive" },
  accepted: { label: "Joined", variant: "secondary" },
};

/**
 * Which invites the list shows (UX audit PEOPLE-10). It listed every invite ever sent — joined and
 * revoked ones included — with no paging, so the handful still waiting were buried under history.
 * Outstanding is the default; the rest are a click away.
 */
const FILTERS = ["outstanding", "joined", "revoked", "all"] as const;
type InviteFilter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<InviteFilter, string> = {
  outstanding: "Waiting",
  joined: "Joined",
  revoked: "Revoked",
  all: "All",
};
const OUTSTANDING: ReadonlySet<Derived> = new Set(["pending", "expired", "locked"]);
const inFilter = (state: Derived, f: InviteFilter) =>
  f === "all" ||
  (f === "outstanding" ? OUTSTANDING.has(state) : f === "joined" ? state === "accepted" : state === "revoked");

/** Rows per page. */
const PAGE_SIZE = 10;

export function PendingInvites({ refreshKey = 0 }: { refreshKey?: number }) {
  const { can } = usePermissions();
  // `employees:view` is the frontend id for the server's `EmployeesRead` bit (10) — see
  // lib/permission-bits.ts. Don't reach for "employees:read"; it isn't in the catalog.
  const canRead = can("employees:view");
  const canManage = can("employees:manage");

  const [invites, setInvites] = useState<ApiInvite[] | null>(null);
  /** A failed read — said, with Retry. It used to collapse the section as if nobody was invited. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [roles, setRoles] = useState<ApiRole[] | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[] | null>(null);
  /** invite_id currently being acted on — disables just that row's actions, not the whole table. */
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Revoking kills the invite link at once — confirmed, by address (XC-07). */
  const [revoking, setRevoking] = useState<ApiInvite | null>(null);
  const [filter, setFilter] = useState<InviteFilter>("outstanding");
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    if (!canRead) return;
    setLoadFailed(false);
    listInvites()
      .then((list) => {
        setInvites(list);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, [canRead]);

  useEffect(load, [load, refreshKey]);

  // Names for the ids the invite row carries. Best-effort — a failed read leaves the cell at "—"
  // rather than calling every department "Unknown".
  useEffect(() => {
    if (!canRead) return;
    let live = true;
    listRoles()
      .then((r) => live && setRoles(r))
      .catch(() => {});
    listDepartments()
      .then((d) => live && setDepartments(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [canRead]);

  // `Date.now()` is read here rather than in render: expiry only needs re-deriving when the list
  // changes, and pinning it to the fetch keeps rows stable across unrelated re-renders.
  const rows = useMemo(() => {
    const nowMs = Date.now();
    const nowSecs = Math.floor(nowMs / 1000);
    return (invites ?? [])
      .map((i) => ({
        invite: i,
        state: derive(i, nowSecs),
        email: emailMeta(i, nowMs),
      }))
      // Newest first — the invite you need to fix is almost always the one you sent yesterday.
      .sort((a, b) => (b.invite.created_at ?? 0) - (a.invite.created_at ?? 0));
  }, [invites]);

  async function handleResend(invite: ApiInvite) {
    setBusyId(invite.invite_id);
    try {
      await resendInvite(invite.invite_id);
      toast.success(`New invite on its way to ${invite.email}`, {
        description:
          "Their previous link and one-time password no longer work. The Delivery column shows when it's sent.",
      });
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't resend the invite.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(invite: ApiInvite) {
    setBusyId(invite.invite_id);
    try {
      await revokeInvite(invite.invite_id);
      setRevoking(null);
      toast.success(`Invite for ${invite.email} revoked`, {
        description: "The link stops working and the address is free to invite again.",
      });
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't revoke the invite.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canRead) return null;

  if (loadFailed && invites === null) {
    return (
      <Card>
        <CardHeader className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="size-4 text-muted-foreground" />
            Invited
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          Couldn&apos;t load your invites, so anyone still waiting to join isn&apos;t listed here.
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Still loading, or the org has never invited anyone — render nothing at all.
  if (!rows.length) return null;

  // An unset id is "—"; an id the loaded list doesn't carry is named as unknown; while the list
  // hasn't loaded (or failed) it is "—" too, rather than calling everything unknown.
  const roleName = (id: string) =>
    !id || !roles ? "—" : (roles.find((r) => r.id === id)?.name ?? UNKNOWN_ROLE);
  const deptName = (id: string) =>
    !id || !departments
      ? "—"
      : (departments.find((d) => d.id === id)?.name ?? UNKNOWN_DEPARTMENT);

  const counts: Record<InviteFilter, number> = {
    outstanding: rows.filter((r) => OUTSTANDING.has(r.state)).length,
    joined: rows.filter((r) => r.state === "accepted").length,
    revoked: rows.filter((r) => r.state === "revoked").length,
    all: rows.length,
  };
  const expired = rows.filter((r) => r.state === "expired").length;
  const unsent = rows.filter(
    (r) => (r.state === "pending" || r.state === "locked") && r.email?.failed,
  ).length;

  const visible = rows.filter((r) => inFilter(r.state, filter));
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  /**
   * The header says what is true of the whole list. "Everyone invited has joined" sat above a
   * revoked invite (PEOPLE-10) — it counted only the waiting ones and said the rest had joined.
   */
  const closedSummary = [
    counts.joined ? `${counts.joined} joined` : "",
    counts.revoked ? `${counts.revoked} revoked` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const headline = counts.outstanding
    ? `${counts.outstanding} ${counts.outstanding === 1 ? "person hasn't" : "people haven't"} joined yet${
        expired ? ` (${expired} expired)` : ""
      }.`
    : `No one is waiting to join${closedSummary ? ` — ${closedSummary}` : ""}.`;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="size-4 text-muted-foreground" />
            Invited
          </CardTitle>
          <p className="text-sm text-muted-foreground">{headline}</p>
          {unsent ? (
            <p className="text-destructive text-sm">
              {unsent === 1 ? "1 invite email" : `${unsent} invite emails`} didn&apos;t go out — see
              the Delivery column.
            </p>
          ) : null}
          {loadFailed ? (
            <p className="text-sm text-warning">
              Couldn&apos;t refresh the list — this is what it showed last time.{" "}
              <button type="button" onClick={load} className="font-medium underline underline-offset-2">
                Retry
              </button>
            </p>
          ) : null}
          {/* At the server's cap the newest invites can be the ones left out — a second import of
              a large file lands exactly there — so the counts above are not the whole story
              (QA audit 2026-10-08, WP-219). */}
          {(invites?.length ?? 0) >= SERVER_LIST_CAP ? (
            <p className="text-xs text-warning">
              This list shows at most {SERVER_LIST_CAP.toLocaleString()} invites, so some may be
              missing here. They still work: anyone holding one can still join.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Show invites">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className="h-7 gap-1.5 px-2.5"
            >
              {FILTER_LABEL[f]}
              <span className="text-muted-foreground tabular-nums">{counts[f]}</span>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {shown.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {filter === "outstanding"
              ? "No invites are waiting. Joined and revoked ones are under the other filters."
              : `No ${FILTER_LABEL[filter].toLowerCase()} invites.`}
          </p>
        ) : (
          <Table scrollLabel="Invites">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>
                  {filter === "outstanding" ? "Expires" : filter === "all" ? "Date" : "Invited"}
                </TableHead>
                {canManage ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map(({ invite, state, email }) => {
                const meta = STATUS_META[state];
                // Only an outstanding invite can be acted on — the server guards on `pending` or
                // `locked` (Resend unlocks it), so offering Resend on a revoked row would just 409.
                const actionable = OUTSTANDING.has(state);
                // An expiry is only news on an invite that can still be used; a joined or revoked
                // one shows when it was sent (PEOPLE-10).
                const when = actionable
                  ? `${filter === "all" ? "Expires " : ""}${invite.expires_at ? formatDate(invite.expires_at * 1000) : "—"}`
                  : `${filter === "all" ? "Invited " : ""}${invite.created_at ? formatDate(invite.created_at) : "—"}`;
                return (
                  <TableRow key={invite.invite_id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{roleName(invite.role_id)}</TableCell>
                    <TableCell>{deptName(invite.department_id)}</TableCell>
                    <TableCell>{invite.title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {/* Only while the invite still matters — a joined or revoked one's email is
                          history. */}
                      {email && actionable ? (
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className={email.tone} title={email.hint}>
                            {email.label}
                          </span>
                          {email.failed && canManage && state !== "expired" ? (
                            <Button
                              variant="link"
                              size="xs"
                              className="h-auto px-0"
                              disabled={busyId === invite.invite_id}
                              onClick={() => handleResend(invite)}
                            >
                              Resend
                            </Button>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        {actionable ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${invite.email}`}
                                  disabled={busyId === invite.invite_id}
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            {/* `w-auto`: the popup primitive pins `w-(--anchor-width)`, and the
                                anchor here is a 32px icon button — so the menu came out 8rem wide
                                and wrapped "Send a new invite" onto two lines. */}
                            <DropdownMenuContent align="end" className="w-auto min-w-52">
                              {/* A plain element, not `DropdownMenuLabel`. That component wraps Base
                                  UI's `Menu.GroupLabel`, which reads context from a `Menu.Group`
                                  and **throws when rendered without one** — opening this menu
                                  crashed the whole Employees page. This was the app's only use of
                                  it, so the trap had never been hit before. The email is decorative
                                  here anyway: the trigger already announces it via aria-label. */}
                              <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                                {invite.email}
                              </div>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 whitespace-nowrap"
                                onClick={() => handleResend(invite)}
                              >
                                <RotateCcw className="size-4 text-muted-foreground" />
                                Send a new invite
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                className="gap-2 whitespace-nowrap"
                                onClick={() => setRevoking(invite)}
                              >
                                <Trash2 className="size-4" />
                                Revoke invite
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {visible.length > PAGE_SIZE ? (
          <TablePagination
            page={safePage}
            pageCount={pageCount}
            total={visible.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            className="border-t px-4 py-3"
          />
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke the invite for ${revoking?.email ?? ""}?`}
        description="Their invite link and code stop working straight away. If they still need to join, you'll have to send a new invite."
        confirmLabel="Revoke invite"
        destructive
        busy={revoking ? busyId === revoking.invite_id : false}
        onConfirm={() => revoking && void handleRevoke(revoking)}
      />
    </Card>
  );
}
