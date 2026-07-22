"use client";

/**
 * The two ways to remove an employee, per the product decision — **Deactivate** (reversible) and
 * **Delete** (permanent). They are not the same, and the UI is deliberate about the difference:
 *
 * - **Deactivate** disables the person's login immediately and reassigns their projects/tasks, but
 *   keeps them as a `deactivated` record — reversible via Reactivate. Backed by the live route.
 * - **Delete** erases them from the org entirely. Irreversible, so it requires typing the name to
 *   confirm. ⚠️ **The backend `DELETE /v1/employees/{id}` route does not exist yet** (the workforce
 *   context ships only deactivation, to preserve time/payroll/audit records) — so Delete will fail
 *   until that route ships. The dialog reports the failure honestly and points back to Deactivate.
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
import {
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
} from "../services/employees.service";

type Status = "active" | "deactivated" | "inactive" | "invited" | "suspended";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
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
  // No `code` (e.g. the route 404s because it isn't deployed yet) → the honest fallback.
  return "Couldn't delete — permanent removal isn't available yet. Deactivate instead?";
}

export function EmployeeManageMenu({
  id,
  name,
  status,
  onChanged,
}: {
  id: string;
  name: string;
  status: Status;
  /** Called after a successful deactivate/reactivate (delete navigates away instead). */
  onChanged: () => void;
}) {
  const router = useRouter();
  const isActive = status === "active";

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
        messageOf(e, `Couldn't ${isActive ? "deactivate" : "reactivate"} ${name}. Try again.`),
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setActivationOpen(true)}>
            {isActive ? (
              <>
                <UserX className="size-4" /> Deactivate
              </>
            ) : (
              <>
                <UserCheck className="size-4" /> Reactivate
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setConfirmName("");
              setDeleteOpen(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" /> Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate / Reactivate — reversible */}
      <Dialog open={activationOpen} onOpenChange={(o) => !busy && setActivationOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}</DialogTitle>
            <DialogDescription>
              {isActive
                ? "Their sign-in is disabled immediately, and their projects and tasks are reassigned. Their record and history stay — you can reactivate them any time."
                : "They regain access at their next sign-in and can be assigned work again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivationOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={toggleActivation} disabled={busy}>
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
              This removes the employee from the organization entirely — not the same as deactivating,
              and it <span className="font-medium text-foreground">cannot be undone</span>. Their time,
              attendance and payroll history stay on record; their login, directory entry and email are
              erased.
            </DialogDescription>
          </DialogHeader>

          {isActive ? (
            // Permanent delete is only allowed once the deactivation saga has reassigned their work
            // and released their seat/devices — so an active employee is steered there first.
            <div className="min-w-0 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <span className="font-medium text-foreground">Deactivate {name} first.</span>{" "}
              <span className="text-muted-foreground">
                Permanent deletion is only allowed on a deactivated employee — deactivating reassigns
                their projects and revokes access. Close this, choose Deactivate, then delete.
              </span>
            </div>
          ) : (
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Type <span className="font-medium text-foreground">{name}</span> to confirm.
              </p>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={name}
                autoFocus
                aria-label="Type the employee's name to confirm deletion"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
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
