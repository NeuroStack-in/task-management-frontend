"use client";

/**
 * Leave-type administration — on the **live backend** (`/v1/leave/types`, leave-approvals context).
 *
 * Rendered on the Leave page for holders of `leave:manage` (backend `Permission::LeaveManage`);
 * everyone else never sees it. The catalog is **replace-whole and version-locked** (LLD §8): every
 * edit/add/archive is a `PUT` of the full list with the last-read `version`, and a concurrent edit
 * surfaces as `409 version_conflict` (handled by refetching). Archiving is the soft delete — there
 * is no per-type DELETE; `active: false` hides a type from the request picker and from balance
 * seeding while keeping its history labelled. "Restore defaults" resets the whole catalog to the
 * platform set; "Seed balances" materializes the year's per-employee balances (idempotent).
 */
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  History,
  Pencil,
  Plus,
  Sprout,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api";
import {
  getTypeCatalog,
  restoreDefaultTypes,
  seedBalances,
  setTypes,
  type ApiLeaveType,
  type ApiTypeCatalog,
} from "../services/leave.service";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** `type_id`s are internal slugs (platform defaults: `annual`, `sick`, …) — derive from the name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Mirrors the server's validation (`leave_types::dto::validate`): name required,
// allowance a whole number of days, capped at 366.
const typeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60, "Keep it under 60 characters."),
  annual_allowance: z.coerce
    .number({ invalid_type_error: "Enter a number of days." })
    .int("Whole days only.")
    .min(0, "Can't be negative.")
    .max(366, "The server caps allowances at 366 days."),
  paid: z.boolean(),
});

type TypeFormValues = z.infer<typeof typeSchema>;

export function LeaveTypesManager({ onCatalogChanged }: { onCatalogChanged?: () => void }) {
  const [catalog, setCatalog] = useState<ApiTypeCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog: the type being edited, or "new" for an add.
  const [editing, setEditing] = useState<ApiLeaveType | "new" | null>(null);
  // Confirm dialogs.
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getTypeCatalog()
      .then((c) => {
        if (live) setCatalog(c);
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load the leave types."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  /** Apply a catalog write; on a version conflict, refetch so the next attempt starts fresh. */
  async function applyCatalog(next: Promise<ApiTypeCatalog>, successMsg: string): Promise<boolean> {
    setBusy(true);
    try {
      const updated = await next;
      setCatalog(updated);
      toast.success(successMsg);
      onCatalogChanged?.();
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Someone else changed the leave types — the list has been refreshed. Try again.");
        load();
      } else {
        toast.error(messageOf(e, "Couldn't save the leave types."));
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveType(values: TypeFormValues): Promise<boolean> {
    if (!catalog) return false;
    let next: ApiLeaveType[];
    if (editing && editing !== "new") {
      next = catalog.types.map((t) =>
        t.type_id === editing.type_id ? { ...t, ...values, name: values.name.trim() } : t,
      );
    } else {
      const base = slugify(values.name) || "type";
      let id = base;
      for (let n = 2; catalog.types.some((t) => t.type_id === id); n++) id = `${base}-${n}`;
      next = [
        ...catalog.types,
        { type_id: id, ...values, name: values.name.trim(), active: true },
      ];
    }
    return applyCatalog(
      setTypes(next, catalog.version),
      editing === "new" ? "Leave type added" : "Leave type updated",
    );
  }

  async function toggleActive(t: ApiLeaveType) {
    if (!catalog) return;
    const next = catalog.types.map((x) =>
      x.type_id === t.type_id ? { ...x, active: !x.active } : x,
    );
    await applyCatalog(
      setTypes(next, catalog.version),
      t.active ? `“${t.name}” archived` : `“${t.name}” restored`,
    );
  }

  async function restoreDefaults() {
    const ok = await applyCatalog(
      restoreDefaultTypes(),
      "Leave types reset to the platform defaults",
    );
    if (ok) setConfirmRestore(false);
  }

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Leave types</CardTitle>
          <CardDescription>
            The org&apos;s leave catalog — what employees can request, and each type&apos;s annual
            allowance. Archived types stay on old requests but can&apos;t be requested.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmSeed(true)} disabled={busy}>
            <Sprout className="size-4" /> Seed balances
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmRestore(true)} disabled={busy}>
            <History className="size-4" /> Restore defaults
          </Button>
          <Button size="sm" onClick={() => setEditing("new")} disabled={busy || !catalog}>
            <Plus className="size-4" /> Add type
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 px-5 pb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-5 pb-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Type</TableHead>
                <TableHead>Allowance</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog?.types.map((t) => (
                <TableRow key={t.type_id} className={t.active ? undefined : "opacity-60"}>
                  <TableCell className="pl-5">
                    <span className="font-medium">{t.name}</span>{" "}
                    <span className="text-xs text-muted-foreground">({t.type_id})</span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {t.annual_allowance > 0 ? `${t.annual_allowance} days / yr` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.paid ? "Paid" : "Unpaid"}</TableCell>
                  <TableCell>
                    {t.active ? (
                      <Badge className="bg-success/12 font-medium text-success">Active</Badge>
                    ) : (
                      <Badge className="bg-muted font-medium text-muted-foreground">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditing(t)}
                        disabled={busy}
                        aria-label={`Edit ${t.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => toggleActive(t)}
                        disabled={busy}
                        aria-label={t.active ? `Archive ${t.name}` : `Restore ${t.name}`}
                      >
                        {t.active ? (
                          <Archive className="size-3.5" />
                        ) : (
                          <ArchiveRestore className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TypeEditDialog
        key={editing === "new" ? "new" : (editing?.type_id ?? "closed")}
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={saveType}
      />

      {/* Restore defaults — a whole-catalog reset, so it gets an explicit confirm. */}
      <Dialog open={confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore the default leave types?</DialogTitle>
            <DialogDescription>
              This replaces the entire catalog with the platform defaults — Annual Leave (20 days),
              Sick Leave (10), Casual Leave (7) and Unpaid Leave — discarding every custom type and
              edit. Balances already granted this year are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={restoreDefaults} disabled={busy}>
              {busy ? "Restoring…" : "Restore defaults"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SeedBalancesDialog open={confirmSeed} onOpenChange={setConfirmSeed} />
    </Card>
  );
}

/** Add/edit one type. Keyed by the parent so it remounts (and re-defaults) per target. */
function TypeEditDialog({
  editing,
  onClose,
  onSave,
}: {
  editing: ApiLeaveType | "new" | null;
  onClose: () => void;
  onSave: (values: TypeFormValues) => Promise<boolean>;
}) {
  const isNew = editing === "new";
  const target = editing === "new" ? null : editing;
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TypeFormValues>({
    resolver: zodResolver(typeSchema),
    defaultValues: isNew
      ? { name: "", annual_allowance: 0, paid: true }
      : {
          name: editing?.name ?? "",
          annual_allowance: editing?.annual_allowance ?? 0,
          paid: editing?.paid ?? true,
        },
  });
  const paid = watch("paid");

  const submit = handleSubmit(async (values) => {
    if (await onSave(values)) onClose();
  });

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add leave type" : `Edit “${target?.name ?? ""}”`}</DialogTitle>
          <DialogDescription>
            Allowances are uniform across all employees, granted up-front per year in whole days.
            Changes apply when balances are next seeded — days already granted this year keep their
            allowance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input placeholder="e.g. Parental Leave" {...register("name")} />
            {errors.name ? (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Annual allowance (days)</Label>
            <Input
              type="number"
              min={0}
              max={366}
              step={1}
              {...register("annual_allowance")}
            />
            <p className="text-xs text-muted-foreground">
              0 = no fixed allowance (e.g. unpaid leave).
            </p>
            {errors.annual_allowance ? (
              <p className="text-xs text-destructive">{errors.annual_allowance.message}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <Label className="text-sm">Paid leave</Label>
              <p className="text-xs text-muted-foreground">Counts as paid time off.</p>
            </div>
            <Switch checked={paid} onCheckedChange={(v) => setValue("paid", v)} aria-label="Paid leave" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isNew ? "Add type" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Seed balances confirm — described from the backend slice (`seed_balances`): one balance row per
 * active employee per active type, at the type's annual allowance, for the chosen year. Idempotent:
 * existing balances (and days already used) are left untouched. Normally this happens automatically
 * on join / at year rollover; this is the manual admin trigger.
 */
function SeedBalancesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [seeding, setSeeding] = useState(false);
  const yearOk = /^\d{4}$/.test(year);

  async function seed() {
    if (!yearOk) return;
    setSeeding(true);
    try {
      const res = await seedBalances(year);
      toast.success(
        `Balances seeded for ${res.year}`,
        {
          description: `${res.seeded_users} active employee${res.seeded_users === 1 ? "" : "s"} processed — existing balances were left untouched.`,
        },
      );
      onOpenChange(false);
    } catch (e) {
      toast.error(messageOf(e, "Couldn't seed the balances."));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seed leave balances?</DialogTitle>
          <DialogDescription>
            Creates the year&apos;s leave balances for every active employee — one per active leave
            type, at its annual allowance. Safe to re-run: employees who already have a balance keep
            it, including any days used. Run this after changing types or at the start of a year.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-sm">Year</Label>
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            className="w-28 tabular-nums"
            aria-label="Year to seed"
          />
          {!yearOk ? <p className="text-xs text-destructive">Enter a 4-digit year.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={seeding}>
            Cancel
          </Button>
          <Button onClick={seed} disabled={seeding || !yearOk}>
            {seeding ? "Seeding…" : "Seed balances"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
