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
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  listInvites,
  listDepartments,
  resendInvite,
  revokeInvite,
  type ApiDepartment,
  type ApiInvite,
} from "../services/employees.service";

/** `pending` past its expiry is expired — the server expires lazily, so status alone under-reports. */
type Derived = "pending" | "expired" | "revoked" | "accepted";

function derive(invite: ApiInvite, nowSecs: number): Derived {
  if (invite.status === "revoked") return "revoked";
  if (invite.status === "accepted") return "accepted";
  return invite.expires_at > 0 && invite.expires_at < nowSecs ? "expired" : "pending";
}

const STATUS_META: Record<
  Derived,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Awaiting acceptance", variant: "default" },
  expired: { label: "Expired", variant: "outline" },
  revoked: { label: "Revoked", variant: "destructive" },
  accepted: { label: "Joined", variant: "secondary" },
};

function formatDate(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PendingInvites({ refreshKey = 0 }: { refreshKey?: number }) {
  const { can } = usePermissions();
  // `employees:view` is the frontend id for the server's `EmployeesRead` bit (10) — see
  // lib/permission-bits.ts. Don't reach for "employees:read"; it isn't in the catalog.
  const canRead = can("employees:view");
  const canManage = can("employees:manage");

  const [invites, setInvites] = useState<ApiInvite[] | null>(null);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  /** invite_id currently being acted on — disables just that row's actions, not the whole table. */
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!canRead) return;
    listInvites()
      .then(setInvites)
      // An empty array, not null: a failed read should collapse the section like "no invites"
      // rather than leave a spinner on the employees page forever.
      .catch(() => setInvites([]));
  }, [canRead]);

  useEffect(load, [load, refreshKey]);

  // Names for the ids the invite row carries. Best-effort — an unresolved id degrades to the id
  // itself rather than blanking the cell.
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
    const nowSecs = Math.floor(Date.now() / 1000);
    return (invites ?? []).map((i) => ({ invite: i, state: derive(i, nowSecs) }));
  }, [invites]);

  async function handleResend(invite: ApiInvite) {
    setBusyId(invite.invite_id);
    try {
      await resendInvite(invite.invite_id);
      toast.success(`New invite sent to ${invite.email}`, {
        description: "Their previous link and one-time password no longer work.",
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

  // Nothing to show, or not allowed to see it — render nothing at all.
  if (!canRead || !rows.length) return null;

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? id;
  const outstanding = rows.filter((r) => r.state === "pending" || r.state === "expired").length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailCheck className="size-4 text-muted-foreground" />
            Invited
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {outstanding
              ? `${outstanding} ${outstanding === 1 ? "person hasn't" : "people haven't"} joined yet.`
              : "Everyone invited has joined."}
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                {canManage ? <TableHead className="w-10" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ invite, state }) => {
                const meta = STATUS_META[state];
                // Only an outstanding invite can be acted on — the server guards on `pending`, so
                // offering Resend on a revoked row would just surface a 409.
                const actionable = state === "pending" || state === "expired";
                return (
                  <TableRow key={invite.invite_id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>{roleName(invite.role_id)}</TableCell>
                    <TableCell>{deptName(invite.department_id)}</TableCell>
                    <TableCell>{invite.title || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(invite.expires_at)}
                    </TableCell>
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
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResend(invite)}>
                                <RotateCcw className="size-4" /> Send a new invite
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleRevoke(invite)}
                              >
                                <Trash2 className="size-4" /> Revoke
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
        </div>
      </CardContent>
    </Card>
  );
}
