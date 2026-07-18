"use client";

/**
 * Ownership & closure — wired to the real `identity` context (LLD §16).
 *
 * Four live routes: `POST /v1/org/transfer-ownership`, `/close`, `/reopen`, `/export`
 * (see `../services/org.service.ts`).
 *
 * ## Three honesty constraints this screen is built around
 *
 * 1. **Owner-only, and by a flag — not a permission bit.** The server's `require_owner()` checks
 *    `is_owner` on the token; an admin holding every permission bit still gets `403`. The frontend
 *    learns this from the id token too: the pre-token trigger stamps `is_owner`, and login maps it to
 *    `roleId: "role-owner"`, whose role carries the wildcard. Everything here gates on that.
 * 2. **The confirmation is the workspace SLUG, and we don't know it.** There is no `GET /v1/org`, so
 *    the client can never read `slug`. We therefore do **not** pre-fill it, hint it, or validate it
 *    locally — we send exactly what the user typed and let `ownership::data::confirm_slug` compare.
 *    A mismatch comes back as a 400 with the server's message.
 * 3. **Closing is a 30-day grace, not an instant delete.** `close` sets `status=closing` and
 *    `purge_after = now + 30d`, and `reopen` undoes it. The copy says so. Also, because the org's
 *    status can't be read on load, the closing banner only reflects a transition made in this
 *    session — a reload forgets it.
 *
 * The export button records a job (`ExportAccepted { job_id, status }`). The archive walk is an
 * explicit server-side seam and there is no job-status route, so we report the job id and never
 * offer a download.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Lock,
  TriangleAlert,
  ArrowLeftRight,
  ChevronDown,
  Check,
  Download,
  CheckCircle2,
  ShieldOff,
  FolderX,
  ReceiptText,
  Loader2,
  RotateCcw,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/stores/auth.store";
import { WILDCARD } from "@/constants/permissions";
import { ApiError } from "@/lib/api";
import {
  listEmployees,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  closeOrg,
  reopenOrg,
  requestOrgExport,
  transferOwnership,
  type ApiOrgStatus,
} from "@/modules/settings/services/org.service";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The one option that isn't a role id: the outgoing owner leaves the org entirely. */
const LEAVE = "__leave__";

/** What a completed close removes once the 30-day grace expires. */
const CONSEQUENCES = [
  {
    icon: ShieldOff,
    text: "Every member loses access and their sign-in is disabled.",
  },
  {
    icon: FolderX,
    text: "All projects, tasks, time entries, reports, and activity history are erased.",
  },
  {
    icon: ReceiptText,
    text: "The subscription is cancelled and billing for this organization stops.",
  },
];

/** Turn any thrown value into the server's own words. 403 means "not the owner". */
function messageOf(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "Only the Organization Owner can do this.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : `Couldn't ${action}.`;
}

/** `purge_after` is epoch **seconds** (the rest of the API uses ms — this one doesn't). */
function formatPurgeDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function OwnershipSettings() {
  const router = useRouter();
  const { role } = usePermissions();
  const currentUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // The wildcard role is the projection of the token's `is_owner` claim (see auth.service.ts).
  const isOwner = role?.permissions.includes(WILDCARD) ?? false;

  // ── Candidates + exit roles (both real endpoints) ──
  const [members, setMembers] = useState<ApiEmployee[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);

  const loadPeople = useCallback(() => {
    let live = true;
    setLoadingPeople(true);
    setPeopleError(null);
    Promise.all([listEmployees(), listRoles()])
      .then(([e, r]) => {
        if (!live) return;
        setMembers(e);
        setRoles(r);
      })
      .catch((err: unknown) => {
        if (live) setPeopleError(messageOf(err, "load your team"));
      })
      .finally(() => {
        if (live) setLoadingPeople(false);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!isOwner) {
      setLoadingPeople(false);
      return;
    }
    return loadPeople();
  }, [isOwner, loadPeople]);

  /** Eligible successors: active members other than the current owner. */
  const candidates = useMemo(
    () =>
      members.filter(
        (m) => m.status === "active" && m.user_id !== currentUser?.id,
      ),
    [members, currentUser?.id],
  );

  /** Roles the outgoing owner may step down into — anything but Owner itself. */
  const exitRoles = useMemo(() => roles.filter((r) => !r.is_owner), [roles]);

  const [newOwnerId, setNewOwnerId] = useState<string | null>(null);
  const newOwner = candidates.find((u) => u.user_id === newOwnerId) ?? null;
  const [takeRole, setTakeRole] = useState<string>(LEAVE);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferConfirm, setTransferConfirm] = useState("");
  const [transferring, setTransferring] = useState(false);

  // ── Export ──
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── Close / reopen ──
  const [orgStatus, setOrgStatus] = useState<ApiOrgStatus | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState("");
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);

  const isClosing = orgStatus?.status === "closing";

  async function handleTransfer() {
    if (!newOwner || transferring) return;
    setTransferring(true);
    try {
      const result = await transferOwnership({
        new_owner_id: newOwner.user_id,
        // Omitted entirely when leaving — the server reads "no take_role" as "deactivate me".
        ...(takeRole === LEAVE ? {} : { take_role: takeRole }),
        confirm: transferConfirm,
      });
      setTransferOpen(false);
      setTransferConfirm("");
      setNewOwnerId(null);
      if (result.transferor_left) {
        toast.success("Ownership transferred", {
          description: `${newOwner.name} is now the Organization Owner. Your account was deactivated — signing you out.`,
        });
        logout();
        router.push("/");
        return;
      }
      toast.success("Ownership transferred", {
        description: `${newOwner.name} is now the Organization Owner. Your new role applies at your next sign-in.`,
      });
    } catch (err) {
      toast.error("Couldn't transfer ownership", {
        description: messageOf(err, "transfer ownership"),
      });
    } finally {
      setTransferring(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const job = await requestOrgExport();
      setExportJobId(job.job_id);
      toast.success("Export requested", {
        description: `Job ${job.job_id} — ${job.status}. You'll be notified when the archive is ready.`,
      });
    } catch (err) {
      toast.error("Couldn't request an export", {
        description: messageOf(err, "request an export"),
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      const status = await closeOrg(closeConfirm);
      setOrgStatus(status);
      setCloseOpen(false);
      setCloseConfirm("");
      setAcknowledged(false);
      toast.success("Organization closing", {
        description: status.purge_after
          ? `Data is permanently deleted on ${formatPurgeDate(status.purge_after)}. You can reopen until then.`
          : "You can reopen it during the grace period.",
      });
    } catch (err) {
      toast.error("Couldn't close the organization", {
        description: messageOf(err, "close the organization"),
      });
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    if (reopening) return;
    setReopening(true);
    try {
      const status = await reopenOrg();
      setOrgStatus(status);
      toast.success("Organization reopened", {
        description: "The scheduled deletion was cancelled.",
      });
    } catch (err) {
      toast.error("Couldn't reopen the organization", {
        description: messageOf(err, "reopen the organization"),
      });
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ownership & deletion"
        description="Transfer the organization to another owner, export your data, or close this organization."
      />

      {!isOwner && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Only the{" "}
          <span className="font-medium text-foreground">Organization Owner</span>{" "}
          can transfer ownership or close the organization.
        </div>
      )}

      {isClosing && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2.5 text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>
              This organization is scheduled for deletion
              {orgStatus?.purge_after
                ? ` on ${formatPurgeDate(orgStatus.purge_after)}`
                : ""}
              . Reopen it any time before then to cancel.
            </span>
          </span>
          <Button
            variant="outline"
            onClick={handleReopen}
            disabled={reopening}
            className="shrink-0 gap-1.5"
          >
            {reopening ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reopen organization
          </Button>
        </div>
      )}

      {/* ── Transfer ownership ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
            <ArrowLeftRight className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Transfer ownership
            </h3>
            <p className="text-sm text-muted-foreground">
              Hand the Organization Owner role to another active member. They gain
              full, unrestricted access. Choose whether you stay on with a
              different role or leave the organization entirely.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-border px-6 py-4">
          {isOwner && peopleError && (
            <p className="text-sm text-destructive">{peopleError}</p>
          )}
          {isOwner && !peopleError && !loadingPeople && candidates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No one to transfer to"
              description="Ownership can only move to another active member. Invite someone first."
            />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-1.5">
                  <Label>New owner</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          disabled={!isOwner || loadingPeople}
                          className="w-full justify-between gap-2 sm:w-64"
                        />
                      }
                    >
                      {loadingPeople ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Loading
                          members…
                        </span>
                      ) : newOwner ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarFallback className="text-[10px]">
                              {initials(newOwner.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{newOwner.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select new owner…
                        </span>
                      )}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-h-72 w-64 overflow-y-auto"
                    >
                      {candidates.map((u) => (
                        <DropdownMenuItem
                          key={u.user_id}
                          onClick={() => setNewOwnerId(u.user_id)}
                          className="gap-2"
                        >
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px]">
                              {initials(u.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {u.name}
                            </span>
                            {/* Only what the directory actually returns — no invented email. */}
                            {u.title ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {u.title}
                              </span>
                            ) : null}
                          </span>
                          <Check
                            className={cn(
                              "size-4",
                              u.user_id === newOwnerId
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-1.5">
                  <Label>Your role afterwards</Label>
                  <Select
                    value={takeRole}
                    onValueChange={(v) => setTakeRole(v as string)}
                    disabled={!isOwner || loadingPeople}
                  >
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {exitRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          Stay as {r.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={LEAVE}>
                        Leave the organization
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                disabled={!isOwner || !newOwner}
                onClick={() => {
                  setTransferConfirm("");
                  setTransferOpen(true);
                }}
              >
                <ArrowLeftRight className="size-4" /> Transfer ownership
              </Button>
            </div>
          )}

          {takeRole === LEAVE && (
            <p className="text-xs text-muted-foreground">
              Leaving deactivates your account and disables your sign-in
              immediately after the transfer.
            </p>
          )}
        </div>
      </Card>

      {/* ── Export data ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Download className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Export organization data
            </h3>
            <p className="text-sm text-muted-foreground">
              Request a full copy of your organization — members, projects, tasks,
              and configuration. The export runs in the background; there is no
              download link yet, so the archive will be delivered separately.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          {exportJobId ? (
            <span className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Export requested · job{" "}
              <span className="font-mono text-xs">{exportJobId}</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              No export requested in this session.
            </span>
          )}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!isOwner || exporting}
            className="gap-1.5"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {exportJobId ? "Request again" : "Request export"}
          </Button>
        </div>
      </Card>

      {/* ── Close organization ── */}
      <Card className="gap-0 border border-destructive/30 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Close this organization
            </h3>
            <p className="text-sm text-muted-foreground">
              Schedules permanent deletion after a{" "}
              <span className="font-medium text-foreground">30-day grace period</span>
              . You can reopen it at any point during the grace period; once it
              expires, the deletion cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-destructive/20 px-6 py-5">
          <p className="text-xs font-medium text-muted-foreground">
            When the grace period expires:
          </p>
          <ul className="space-y-2.5">
            {CONSEQUENCES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(Boolean(v))}
              disabled={!isOwner || isClosing}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              I understand this schedules permanent deletion of this organization
              and all of its data, and that it cannot be recovered once the grace
              period ends.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end border-t border-destructive/20 bg-destructive/5 px-6 py-4">
          <Button
            variant="destructive"
            disabled={!isOwner || !acknowledged || isClosing}
            onClick={() => {
              setCloseConfirm("");
              setCloseOpen(true);
            }}
          >
            <TriangleAlert className="size-4" /> Close organization
          </Button>
        </div>
      </Card>

      {/* ── Transfer confirmation ── */}
      <Dialog
        open={transferOpen}
        onOpenChange={(o) => {
          setTransferOpen(o);
          if (!o) setTransferConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              {newOwner?.name} will become the Organization Owner with full
              access, and you will{" "}
              {takeRole === LEAVE ? (
                <span className="font-medium text-foreground">
                  leave the organization
                </span>
              ) : (
                <>
                  become{" "}
                  <span className="font-medium text-foreground">
                    {exitRoles.find((r) => r.id === takeRole)?.name ?? takeRole}
                  </span>
                </>
              )}
              . This cannot be undone. Type your{" "}
              <span className="font-medium text-foreground">workspace slug</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={transferConfirm}
            onChange={(e) => setTransferConfirm(e.target.value)}
            placeholder="workspace slug"
            autoComplete="off"
          />
          {/* We can't read the slug (no GET /v1/org), so the server does the comparing. */}
          <p className="text-xs text-muted-foreground">
            This is your workspace&apos;s URL slug. The server verifies it — a
            mismatch is rejected and nothing changes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!transferConfirm.trim() || transferring}
              onClick={handleTransfer}
              className="gap-1.5"
            >
              {transferring && <Loader2 className="size-4 animate-spin" />}
              Transfer ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close confirmation ── */}
      <Dialog
        open={closeOpen}
        onOpenChange={(o) => {
          setCloseOpen(o);
          if (!o) setCloseConfirm("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close organization?</DialogTitle>
            <DialogDescription>
              This schedules permanent deletion of this organization in 30 days.
              Type your{" "}
              <span className="font-medium text-foreground">workspace slug</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={closeConfirm}
            onChange={(e) => setCloseConfirm(e.target.value)}
            placeholder="workspace slug"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            This is your workspace&apos;s URL slug. The server verifies it — a
            mismatch is rejected and nothing changes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!closeConfirm.trim() || closing}
              onClick={handleClose}
              className="gap-1.5"
            >
              {closing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TriangleAlert className="size-4" />
              )}
              Close organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
