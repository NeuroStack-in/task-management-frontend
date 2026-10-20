"use client";

/**
 * The two ways to remove an employee, per the product decision — **Deactivate** (reversible) and
 * **Delete** (permanent). They are not the same, and the UI is deliberate about the difference:
 *
 * - **Deactivate** disables the person's login immediately and reassigns their projects/tasks, but
 *   keeps them as a `deactivated` record — reversible via Reactivate. Backed by the live route.
 * - **Delete** erases them from the org — `DELETE /v1/employees/{id}`, which removes the login,
 *   directory entry and email claim of an already-deactivated employee and keeps their
 *   time/attendance/payroll history. Irreversible, so it requires typing the name to confirm.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, UserX, UserCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import {
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
} from "../services/employees.service";

type Status = "active" | "deactivated" | "inactive" | "invited" | "suspended";

/** The owner role's id — the same `role_id` the server's deactivate and delete guards read. */
const OWNER_ROLE_ID = "role-owner";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/**
 * Why this person cannot be deactivated from here, if they cannot — mirroring the server's
 * `cannot_deactivate_self` / `cannot_deactivate_owner` (QA audit 2026-10-08, WP-005). Deactivating
 * yourself, or an owner, used to succeed and could leave the org with nobody able to undo it.
 */
function deactivationBlock(isSelf: boolean, roleId: string | undefined): string | null {
  if (isSelf) return "You can't deactivate your own account.";
  if (roleId === OWNER_ROLE_ID) {
    return "Owners can't be deactivated. Transfer or revoke ownership first.";
  }
  return null;
}

/** The server's typed 409s for deactivate, for when one slips past the menu (say, a stale page). */
function deactivateErrorMessage(e: unknown, name: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "cannot_deactivate_self":
        return "You can't deactivate your own account.";
      case "cannot_deactivate_owner":
        return "Owners can't be deactivated. Transfer or revoke ownership first.";
      case "not_active":
        return `${name} is already deactivated.`;
    }
  }
  return messageOf(e, `Couldn't deactivate ${name}. Try again.`);
}

/** Turn the server's typed 409 codes for delete into something an admin can act on. */
function deleteErrorMessage(e: unknown, name: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "must_deactivate_first":
        return `Deactivate ${name} first — permanent delete is only allowed on a deactivated employee.`;
      case "cannot_delete_owner":
        return "The organization owner can't be deleted. Transfer ownership first.";
      case "cannot_delete_self":
        return "You can't delete your own account.";
      case "not_found":
        return `${name} is already gone.`;
    }
  }
  // Anything else is said as what it was — a permission refusal, a server fault, a dropped
  // connection. Every one of them used to read "permanent removal isn't available yet. Deactivate
  // instead?", on an employee who was already deactivated (QA audit 2026-10-08, WP-455).
  return messageOf(e, `Couldn't delete ${name}. Try again.`);
}

export function EmployeeManageMenu({
  id,
  name,
  status,
  roleId,
  onChanged,
}: {
  id: string;
  name: string;
  status: Status;
  /** The employee's role id — an owner cannot be deactivated (see `deactivationBlock`). */
  roleId?: string;
  /** Called after a successful deactivate/reactivate (delete navigates away instead). */
  onChanged: () => void;
}) {
  const router = useRouter();
  const isActive = status === "active";
  const viewerId = useAuthStore((s) => s.user?.id);
  const blocked = isActive ? deactivationBlock(viewerId === id, roleId) : null;

  const [activationOpen, setActivationOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggleActivation() {
    setBusy(true);
    try {
      if (isActive) await deactivateEmployee(id);
      else await reactivateEmployee(id);
      toast.success(isActive ? `${name} deactivated` : `${name} reactivated`);
      setActivationOpen(false);
      onChanged();
    } catch (e) {
      toast.error(
        isActive
          ? deactivateErrorMessage(e, name)
          : messageOf(e, `Couldn't reactivate ${name}. Try again.`),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteEmployee(id);
      toast.success(`${name} removed from the organization`);
      setDeleteOpen(false);
      router.push("/employees"); // the record is gone — leave the now-dead profile
    } catch (e) {
      toast.error(deleteErrorMessage(e, name));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <MoreVertical className="size-4" /> Manage
        </DropdownMenuTrigger>
        {/* `w-auto` overrides the shared content's `w-(--anchor-width)`, which pins the popup to the
            trigger. "Manage" is a narrow button, so inheriting its width wrapped "Delete permanently"
            onto a second line and left the icon floating beside the wrap. Size to content instead. */}
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          <DropdownMenuItem
            onClick={() => setActivationOpen(true)}
            disabled={blocked !== null}
            className="gap-2 py-1.5 whitespace-nowrap"
          >
            {isActive ? (
              blocked ? (
                // Disabled with its reason in place, rather than hidden: a missing action reads as a
                // bug, and the reason is the instruction for what to do instead.
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <UserX className="text-muted-foreground size-4" /> Deactivate
                  </span>
                  <span className="text-muted-foreground max-w-56 text-xs whitespace-normal">
                    {blocked}
                  </span>
                </span>
              ) : (
                <>
                  <UserX className="text-muted-foreground size-4" /> Deactivate
                </>
              )
            ) : (
              <>
                <UserCheck className="text-muted-foreground size-4" /> Reactivate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* `variant="destructive"` rather than hand-rolled text colours: it also carries the
              destructive focus background and tints the icon, which the ad-hoc classes missed —
              the row highlighted in plain grey on hover, like a neutral action.

              Disabled for an active employee, with the reason in place (UX audit PEOPLE-16). It was
              enabled and opened a dialog whose only content was "deactivate first" — a dead end one
              click deep. The path is the Deactivate item directly above. */}
          <DropdownMenuItem
            variant="destructive"
            disabled={isActive}
            onClick={() => {
              setConfirmName("");
              setDeleteOpen(true);
            }}
            className="gap-2 py-1.5 whitespace-nowrap"
          >
            {isActive ? (
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <Trash2 className="size-4" /> Delete permanently
                </span>
                <span className="text-muted-foreground max-w-56 text-xs whitespace-normal">
                  {blocked
                    ? "Only a deactivated employee can be deleted."
                    : "Deactivate them first — only a deactivated employee can be deleted."}
                </span>
              </span>
            ) : (
              <>
                <Trash2 className="size-4" /> Delete permanently
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate / Reactivate — reversible */}
      <Dialog open={activationOpen} onOpenChange={(o) => !busy && setActivationOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}
            </DialogTitle>
            {/* What the deactivation saga actually does (`projects::release_deactivated_user`, the
                fleet and seat consumers). This said projects and tasks were "reassigned" and that
                reactivating undid it — neither is true (UX audit 2026-10-16, PEOPLE-01). */}
            <DialogDescription>
              {isActive
                ? "Their sign-in stops working immediately. This also happens:"
                : "They can sign in again. Their old projects, tasks and devices are not given back — add them to projects again, and re-enrol a device if they need tracking."}
            </DialogDescription>
          </DialogHeader>
          {isActive ? (
            <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
              <li>
                Their tasks are <span className="text-foreground font-medium">unassigned</span>{" "}
                — nobody is put on them in their place.
              </li>
              <li>
                They are removed from their projects. A project they manage keeps them as manager
                until you hand it to someone else.
              </li>
              <li>Their devices stop tracking, and their seat is freed.</li>
              <li>Their time, attendance and payroll history stay on record.</li>
              <li>
                Reactivating them later restores sign-in only — not their projects, tasks or
                devices.
              </li>
            </ul>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivationOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {/* Deactivating ends someone's access and unassigns their work — styled as the
                destructive action it is (PEOPLE-16). Reactivating restores access, so it isn't. */}
            <Button
              variant={isActive ? "destructive" : "default"}
              onClick={toggleActivation}
              disabled={busy}
            >
              {busy ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete — permanent, typed confirmation */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !busy && setDeleteOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name} permanently?</DialogTitle>
            <DialogDescription>
              This removes the employee from the organization entirely — not the same as
              deactivating, and it{" "}
              <span className="text-foreground font-medium">cannot be undone</span>. Their
              time, attendance and payroll history stay on record; their login, directory
              entry and email are erased.
            </DialogDescription>
          </DialogHeader>

          {/* Only reachable for a deactivated employee — the menu item is disabled for an active
              one (PEOPLE-16); the server's `must_deactivate_first` still has its own message. */}
          <div className="min-w-0 space-y-1.5">
            <p className="text-muted-foreground text-xs">
              Type <span className="text-foreground font-medium">{name}</span> to
              confirm.
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={name}
              autoFocus
              aria-label="Type the employee's name to confirm deletion"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={busy || isActive || confirmName.trim() !== name}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
