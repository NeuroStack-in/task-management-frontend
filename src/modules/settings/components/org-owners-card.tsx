"use client";

/**
 * The org's owners — add, remove, and see who holds the role (LLD §16).
 *
 * **This is how ownership is handed over** — there is no separate transfer flow. Adding an owner
 * leaves everyone already holding it in place, which is the ordinary case (a second founder, a
 * deputy, cover for someone on leave); handing over is adding the new owner, then stepping down.
 *
 * **The one rule that cannot be broken: an org must never reach zero owners.** Only an owner can
 * appoint an owner, so an org that loses its last one is unrecoverable from inside the product. The
 * server refuses it with a `last_owner` conflict; this disables the control at one owner so the
 * refusal is something you read *before* acting rather than a failure afterwards.
 *
 * Owner-only, gated on `is_owner` server-side. A non-owner gets 403 and this card hides rather than
 * showing an error — plenty of roles can open this page without being entitled to the section.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Crown, Plus, Search, ShieldMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth.store";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/shared/loader";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApiError } from "@/lib/api";

import { listOwners, grantOwner, revokeOwner, type OrgOwner } from "../services/org.service";
import { listRoles, TIME_TRACK_SELF, type ApiRole } from "@/modules/roles/services/roles.service";
import { useEmployees, type EmployeeRow } from "@/modules/employees/use-employees";
import { cn } from "@/lib/utils";

/**
 * The built-in Employee role (`wp_contracts::roles::ROLE_EMPLOYEE`) — the least-privileged role every
 * org has. It is the default a removed owner drops to, and the one used when the role list can't be
 * read. Removal used to send `role-admin` silently while the dialog promised "an ordinary role", so
 * every former owner kept near-full access (UX audit PEOPLE-08).
 */
const ROLE_EMPLOYEE = "role-employee";

/** Privileges a role grants — contributor-only `time:track:self` is not one (`PermSet::privileges`). */
const privilegeCount = (r: ApiRole) => r.permissions.filter((p) => p !== TIME_TRACK_SELF).length;

/** Most people the picker lists at once; a search narrows the rest. */
const PICKER_LIMIT = 50;

export function OrgOwnersCard() {
  const [owners, setOwners] = useState<OrgOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  /**
   * The list couldn't be read. An empty list used to stand in for it, so the card announced "This
   * organisation has one owner." over a failed request, with no retry (QA audit 2026-10-08, WP-357).
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Adding an owner grants full, unrestricted access — it is confirmed, by name (XC-07). */
  const [confirmAdd, setConfirmAdd] = useState(false);
  /** The owner awaiting a confirmed removal — ownership is the org's top authority (WP-352). */
  const [confirmRemove, setConfirmRemove] = useState<OrgOwner | null>(null);
  const [addId, setAddId] = useState<string | null>(null);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  /** The role the owner being removed will hold afterwards — chosen in the dialog (PEOPLE-08). */
  const [takeRole, setTakeRole] = useState<string>(ROLE_EMPLOYEE);

  const { employees } = useEmployees();

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setLoadFailed(false);
    listOwners()
      .then((r) => live && setOwners(r.owners))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setLoadFailed(true);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  useEffect(() => {
    listRoles()
      .then(setRoles)
      .catch(() => {
        /* the built-in Employee role still works without the list — the dialog says so */
      });
  }, []);

  const ownerIds = useMemo(() => new Set(owners.map((o) => o.user_id)), [owners]);
  // Only active members who are not already owners — granting an existing owner is a no-op, and the
  // server refuses a deactivated one outright.
  const candidates = useMemo(
    // Only people who can sign in. A monitored employee (no login) appointed owner — and then the
    // real owner stepping down — left an org whose every "owner" was unable to log in, the state
    // this card exists to prevent (QA audit 2026-10-08, WP-353).
    () =>
      employees.filter((u) => u.status === "active" && !u.monitored && !ownerIds.has(u.id)),
    [employees, ownerIds],
  );
  // The roles a demoted owner may take, least access first. `role-owner` is excluded: that is not a
  // demotion.
  const takeRoles = useMemo(
    () =>
      roles
        .filter((r) => !r.is_owner && r.id !== "role-owner")
        .sort((a, b) => privilegeCount(a) - privilegeCount(b) || a.name.localeCompare(b.name)),
    [roles],
  );
  /** Employee when the org has it (every org does), else the least-privileged role on offer. */
  const defaultTakeRole = takeRoles.some((r) => r.id === ROLE_EMPLOYEE)
    ? ROLE_EMPLOYEE
    : (takeRoles[0]?.id ?? ROLE_EMPLOYEE);
  const chosenTakeRole = takeRoles.find((r) => r.id === takeRole) ?? null;
  /** The name of the role they'll hold — "Employee" when the list couldn't be read. */
  const takeRoleName = chosenTakeRole?.name ?? "Employee";

  const askRemove = (o: OrgOwner) => {
    setTakeRole(defaultTakeRole);
    setConfirmRemove(o);
  };

  async function add() {
    if (!addId || busy) return;
    setBusy(true);
    try {
      const r = await grantOwner(addId);
      setOwners(r.owners);
      setAddId(null);
      setConfirmAdd(false);
      toast.success("Owner added", {
        description: "They now have full, unrestricted access to this organisation.",
      });
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't add that owner.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(o: OrgOwner) {
    if (busy) return;
    setBusy(true);
    try {
      // Only a role the dialog showed — or, with no list, the built-in Employee it said they'd get.
      const r = await revokeOwner(o.user_id, chosenTakeRole?.id ?? ROLE_EMPLOYEE);
      setOwners(r.owners);
      // Stepping down yourself: re-read the token now, so the owner-only screens close at once
      // rather than at the next silent refresh.
      if (o.is_you) void useAuthStore.getState().refreshClaims();
      toast.success(`${o.is_you ? "You are" : `${o.name} is`} no longer an owner`, {
        description: `${o.is_you ? "You now have" : "They now have"} the ${takeRoleName} role.`,
      });
    } catch (e) {
      // The server's own guards, read from the error **code**: `message` is display text the error
      // formatter has already rewritten ("Conflict: last owner."), so testing it for `last_owner`
      // never matched (QA audit 2026-10-08, WP-531).
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(
        code === "last_owner"
          ? "That's the only owner — add another before removing this one."
          : code === "not_an_owner"
            ? `${o.name} is no longer an owner — the list has been refreshed.`
            : e instanceof ApiError
              ? e.message
              : "Couldn't remove that owner.",
      );
      // Whatever went wrong, show the owners as the server has them now (this list was stale if
      // either guard fired).
      load();
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return null;

  const soleOwner = owners.length <= 1;

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-start gap-4 px-6 py-5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
          <Crown className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="font-heading text-base font-medium">Organization owners</h3>
          <p className="text-sm text-muted-foreground">
            Owners have full, unrestricted access — every permission, on everything.
            An organisation must always have at least one.
          </p>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        {loading ? (
          <Loader label="Loading owners…" />
        ) : loadFailed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Couldn&apos;t load the owners.</p>
            <Button size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {owners.map((o) => (
              <li key={o.user_id} className="flex items-center gap-3 py-3">
                <UserAvatar
                  userId={o.user_id}
                  name={o.name}
                  className="size-9"
                  fallbackClassName="text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {o.name}
                    {o.is_you ? (
                      <Badge variant="secondary" className="ml-2 align-middle">
                        You
                      </Badge>
                    ) : null}
                  </p>
                  {o.email ? (
                    <p className="truncate text-xs text-muted-foreground">{o.email}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || soleOwner}
                  onClick={() => askRemove(o)}
                  // Say *why* it is unavailable rather than leaving a dead control. Self-removal is
                  // allowed when someone else owns the org — stepping down is legitimate.
                  title={
                    soleOwner
                      ? "The only owner cannot be removed — add another first"
                      : o.is_you
                        ? "Step down as an owner"
                        : `Remove ${o.name} as an owner`
                  }
                >
                  <ShieldMinus className="size-3.5" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
        <MemberPicker
          candidates={candidates}
          value={addId}
          onChange={setAddId}
          disabled={loadFailed}
        />
        <Button onClick={() => setConfirmAdd(true)} disabled={!addId || busy || loadFailed}>
          <Plus className="size-4" />
          Add owner
        </Button>
        <ConfirmDialog
          open={confirmAdd}
          onOpenChange={setConfirmAdd}
          title={`Make ${candidates.find((u) => u.id === addId)?.name ?? "this person"} an owner?`}
          description="Owners have full, unrestricted access: every setting, all monitoring data, payroll, billing, and the power to add or remove other owners and close the organization."
          confirmLabel="Make owner"
          busy={busy}
          onConfirm={() => void add()}
        />
        {loading || loadFailed ? null : (
          <p className="text-xs text-muted-foreground sm:ml-auto">
            {soleOwner
              ? "This organisation has one owner."
              : `${owners.length} owners.`}
          </p>
        )}
      </div>
      {/* One click used to strip ownership — the org's top authority — from someone, or from
          yourself (QA audit 2026-10-08, WP-352). */}
      <Dialog open={confirmRemove !== null} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmRemove?.is_you ? "Step down as an owner?" : `Remove ${confirmRemove?.name ?? ""} as an owner?`}
            </DialogTitle>
            <DialogDescription>
              {confirmRemove?.is_you
                ? "You lose owner powers straight away and stay in the organisation with the role below."
                : "They lose owner powers straight away and stay in the organisation with the role below."}
            </DialogDescription>
          </DialogHeader>
          {/* Say which role, and let the remover pick it: the server takes any ordinary role as
              `take_role`, and this used to send Admin while promising "an ordinary role" (PEOPLE-08). */}
          <div className="space-y-2">
            <Label htmlFor="owner-take-role">
              {confirmRemove?.is_you ? "Your role afterwards" : "Their role afterwards"}
            </Label>
            {takeRoles.length > 0 ? (
              <Select
                value={takeRole}
                onValueChange={(v) => typeof v === "string" && v && setTakeRole(v)}
                items={Object.fromEntries(takeRoles.map((r) => [r.id, r.name]))}
                disabled={busy}
              >
                <SelectTrigger id="owner-take-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {takeRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p id="owner-take-role" className="text-sm font-medium">
                Employee
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {chosenTakeRole ? (
                <>
                  {chosenTakeRole.description ? `${chosenTakeRole.description} · ` : ""}
                  {/* The same count the Roles page shows for this role. */}
                  {chosenTakeRole.permissions.length}{" "}
                  {chosenTakeRole.permissions.length === 1 ? "permission" : "permissions"},{" "}
                  {chosenTakeRole.scope === "org"
                    ? "across the organisation"
                    : chosenTakeRole.scope === "team"
                      ? "within their department"
                      : "over their own data only"}
                  .
                  {/* An owner is never tracked (`is_owner` doesn't grant `time:track:self`); a role
                      that does grant it starts recording them — worth saying before, not after. */}
                  {chosenTakeRole.permissions.includes(TIME_TRACK_SELF)
                    ? " With this role, their time, activity and screenshots are recorded."
                    : ""}
                </>
              ) : (
                "The role list couldn't be loaded, so they get the built-in Employee role. You can move them to another role on the Roles page afterwards."
              )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                const o = confirmRemove;
                if (!o) return;
                await remove(o);
                setConfirmRemove(null);
              }}
            >
              {confirmRemove?.is_you ? "Step down" : "Remove owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Who to make an owner — a searchable list, not a bare dropdown of every member: at 150 people the
 * old select was a long scroll with no way to type a name (UX audit PEOPLE-08). Searches what the
 * directory carries: name, employee ID, job title and department (it has no email).
 */
function MemberPicker({
  candidates,
  value,
  onChange,
  disabled,
}: {
  candidates: EmployeeRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const chosen = candidates.find((u) => u.id === value) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((u) =>
      [u.name, u.empId ?? "", u.jobTitle, u.department].some((f) => f.toLowerCase().includes(q)),
    );
  }, [candidates, query]);
  const shown = matches.slice(0, PICKER_LIMIT);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Choose a member to make an owner"
        className={cn(
          "border-input bg-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-sm sm:w-72",
          "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {chosen ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <UserAvatar userId={chosen.id} name={chosen.name} className="size-5" fallbackClassName="text-[0.55rem]" />
            <span className="truncate">{chosen.name}</span>
          </span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">Add an owner…</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto max-w-[calc(100vw-2rem)] min-w-72">
        <div className="relative px-1.5 pt-0.5 pb-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, title or department"
            aria-label="Search members"
            className="h-8 pl-7"
            // Typing must reach the input, not the menu's type-ahead (see `AssigneePicker`).
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No other active members who can sign in.
            </p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No one matches.</p>
          ) : (
            shown.map((u) => (
              <DropdownMenuItem key={u.id} onClick={() => onChange(u.id)} className="gap-2">
                <UserAvatar userId={u.id} name={u.name} className="size-6" fallbackClassName="text-[0.6rem]" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm">{u.name}</span>
                  {u.jobTitle || u.department ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {[u.jobTitle, u.department].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        {matches.length > shown.length ? (
          <p className="border-t px-2 pt-1.5 pb-1 text-center text-xs text-muted-foreground">
            Showing {shown.length} of {matches.length} — type to narrow the list.
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
