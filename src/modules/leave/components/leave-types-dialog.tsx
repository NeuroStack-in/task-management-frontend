"use client";

/**
 * Leave-type catalog editor — `PUT /v1/leave/types` and `POST /v1/leave/types/restore`.
 *
 * The endpoint replaces the whole catalog, so the editor holds a full working copy and sends all of
 * it. `type_id` is the key balances are keyed by, so it is only editable while a row is new;
 * renaming an existing id would orphan every balance already materialized against it.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import type { ApiLeaveType } from "../services/leave.service";

/** A row plus whether it is new (only new rows may set their `type_id`). */
interface Row extends ApiLeaveType {
  isNew: boolean;
}

const toRows = (types: ApiLeaveType[]): Row[] =>
  types.map((t) => ({ ...t, isNew: false }));

/** Slugify a name into a candidate `type_id` — lowercase, alphanumeric + dashes. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LeaveTypesDialog({
  open,
  onOpenChange,
  types,
  loading,
  onSave,
  onRestore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ApiLeaveType[];
  loading: boolean;
  onSave: (types: ApiLeaveType[]) => Promise<void>;
  onRestore: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(types));
  const [busy, setBusy] = useState(false);

  // Re-seed the working copy whenever the dialog opens or the server's catalog changes underneath
  // it (e.g. after a restore), so edits always start from what the server actually holds.
  useEffect(() => {
    if (open) setRows(toRows(types));
  }, [open, types]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        type_id: "",
        name: "",
        paid: true,
        annual_allowance: 0,
        active: true,
        isNew: true,
      },
    ]);

  /** Mirrors the server's validation so the common mistakes are caught before a round trip. */
  function firstProblem(): string | null {
    if (rows.length === 0) return "Keep at least one leave type.";
    const seen = new Set<string>();
    for (const r of rows) {
      const id = r.type_id.trim();
      if (!id || !r.name.trim()) return "Every type needs an id and a name.";
      if (seen.has(id)) return `Duplicate type id: ${id}`;
      seen.add(id);
      if (r.annual_allowance > 366) return "Annual allowance can't exceed 366 days.";
    }
    return null;
  }

  async function save() {
    const problem = firstProblem();
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      await onSave(
        rows.map(({ isNew: _isNew, ...t }) => ({ ...t, type_id: t.type_id.trim() })),
      );
      toast.success("Leave types saved");
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Optimistic lock: someone else saved the catalog since this editor loaded.
        toast.error("Someone else changed the leave types.", {
          description: "Nothing was saved. Close and reopen to pick up their version, then redo your edits.",
        });
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't save leave types. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await onRestore();
      toast.success("Reset to the default leave types");
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't restore the defaults. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Leave types</DialogTitle>
          <DialogDescription>
            The org&apos;s leave catalog. Allowances are whole days, granted up front each year, with
            no carry-over — the same for every employee.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {loading && rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading types…</p>
          ) : (
            rows.map((r, i) => (
              <div key={`${r.type_id}-${i}`} className="space-y-3 rounded-xl border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={r.name}
                      placeholder="e.g. Study Leave"
                      onChange={(e) => {
                        const name = e.target.value;
                        // A new row's id tracks its name until the id is touched directly.
                        update(i, r.isNew ? { name, type_id: slugify(name) } : { name });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Id</Label>
                    <Input
                      value={r.type_id}
                      disabled={!r.isNew}
                      placeholder="study-leave"
                      onChange={(e) => update(i, { type_id: e.target.value })}
                    />
                    {!r.isNew ? (
                      <p className="text-[11px] text-muted-foreground">
                        Fixed — existing balances are keyed by it.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Days / year</Label>
                    <NumberStepper
                      value={r.annual_allowance}
                      min={0}
                      max={366}
                      onChange={(v) => update(i, { annual_allowance: v })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={r.paid}
                      onCheckedChange={(v) => update(i, { paid: v })}
                      aria-label={`${r.name || "Type"} — ${r.paid ? "paid" : "unpaid"}`}
                    />
                    Paid
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => update(i, { active: v })}
                      aria-label={`${r.name || "Type"} — ${r.active ? "active" : "inactive"}`}
                    />
                    Active
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button variant="outline" size="sm" onClick={addRow} disabled={busy}>
            <Plus className="size-4" /> Add type
          </Button>

          <p className="text-xs text-muted-foreground">
            Removing a type stops new requests against it, but balances already materialized for it
            aren&apos;t cleaned up server-side. Switching it to inactive is the gentler option.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={restore} disabled={busy}>
            <RotateCcw className="size-4" /> Restore defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save types"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
