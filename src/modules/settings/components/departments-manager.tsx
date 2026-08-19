"use client";

/**
 * Department management — on the **live backend** (`/v1/departments`, workforce context).
 *
 * List needs `employees:view`; create / rename / delete need `settings:manage` (backend `OrgManage`).
 * Lives on the Organization settings page because departments are org structure. Employees are
 * assigned a department when they accept their invite; this is where the choosable set is defined.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Building2, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type ApiDepartment,
} from "@/modules/employees/services/employees.service";
import { DeptProductivitySheet } from "./org/dept-productivity-sheet";

/**
 * The standard starter set. Kept in step with the backend `create_org` seed (identity crate), so an
 * org created fresh and an org populated from the empty state end up with the same departments.
 * They're not special once created — plain rows the owner can rename or delete.
 */
const STANDARD_DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Finance",
  "People",
];

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function DepartmentsManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Inline rename: the id being edited + its working value.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirm: the department pending deletion.
  const [pendingDelete, setPendingDelete] = useState<ApiDepartment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-department productivity config (weights + rules) — one department at a time.
  const [productivityDept, setProductivityDept] = useState<ApiDepartment | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listDepartments()
      .then((d) => {
        if (live) setDepts([...d].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load departments."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    if (depts.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A department with that name already exists.");
      return;
    }
    setAdding(true);
    try {
      const created = await createDepartment(name);
      setDepts((cur) => [...cur, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      toast.success(`“${created.name}” added`);
    } catch (e) {
      toast.error(messageOf(e, "Couldn't create the department."));
    } finally {
      setAdding(false);
    }
  }

  /**
   * Create the standard starter set — for an org that has none yet. Sequential, not parallel:
   * these are writes, and `apiFetch` deliberately does not retry writes, so bursting ~8 POSTs at the
   * gateway is the wrong shape. Skips any name that already exists so it's safe to re-run.
   */
  async function seedDefaults() {
    setSeeding(true);
    const existing = new Set(depts.map((d) => d.name.toLowerCase()));
    const created: ApiDepartment[] = [];
    let failed = 0;
    for (const name of STANDARD_DEPARTMENTS) {
      if (existing.has(name.toLowerCase())) continue;
      try {
        created.push(await createDepartment(name));
      } catch {
        failed += 1;
      }
    }
    if (created.length) {
      setDepts((cur) => [...cur, ...created].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Added ${created.length} department${created.length === 1 ? "" : "s"}`);
    }
    if (failed) toast.error(`${failed} couldn't be added — you can add them manually.`);
    setSeeding(false);
  }

  function beginEdit(d: ApiDepartment) {
    setEditId(d.id);
    setEditName(d.name);
  }

  async function saveEdit() {
    if (!editId) return;
    const name = editName.trim();
    if (!name) return;
    const original = depts.find((d) => d.id === editId);
    if (original && original.name === name) {
      setEditId(null);
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateDepartment(editId, name);
      setDepts((cur) =>
        cur.map((d) => (d.id === editId ? updated : d)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditId(null);
      toast.success("Department renamed");
    } catch (e) {
      toast.error(messageOf(e, "Couldn't rename the department."));
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDepartment(pendingDelete.id);
      setDepts((cur) => cur.filter((d) => d.id !== pendingDelete.id));
      toast.success(`“${pendingDelete.name}” deleted`);
      setPendingDelete(null);
    } catch (e) {
      // The backend may refuse to delete a department that still has members — surface its reason.
      toast.error(messageOf(e, "Couldn't delete the department."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>
          The departments people can be assigned to. A department is chosen when an employee accepts
          their invite.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading departments…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : (
          <>
            {/* Add — managers only */}
            {canManage ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); add(); }
                  }}
                  placeholder="New department name"
                  aria-label="New department name"
                  disabled={adding}
                />
                <Button onClick={add} disabled={adding || !newName.trim()} className="shrink-0">
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            ) : null}

            {depts.length === 0 ? (
              <div className="flex flex-col items-center">
                <EmptyState
                  icon={Building2}
                  title="No departments yet"
                  description={
                    canManage
                      ? "Add one above, or start from the standard set and edit from there."
                      : "No departments have been created for this organization."
                  }
                  className="border-0 pt-8 pb-4"
                />
                {canManage ? (
                  <Button variant="outline" onClick={seedDefaults} disabled={seeding} className="mb-4">
                    {seeding ? "Adding…" : "Add the standard set"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border">
                {depts.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    {editId === d.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
                            if (e.key === "Escape") setEditId(null);
                          }}
                          className="h-8 flex-1"
                          autoFocus
                          disabled={savingEdit}
                          aria-label="Department name"
                        />
                        <Button size="icon-sm" variant="ghost" onClick={saveEdit} disabled={savingEdit || !editName.trim()} aria-label="Save">
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditId(null)} disabled={savingEdit} aria-label="Cancel">
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-sm font-medium">{d.name}</span>
                        {/* Productivity config is readable by any member; saving is gated inside. */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-muted-foreground"
                          onClick={() => setProductivityDept(d)}
                          aria-label={`Configure productivity for ${d.name}`}
                        >
                          <SlidersHorizontal className="size-3.5" /> Productivity
                        </Button>
                        {canManage ? (
                          <>
                            <Button size="icon-sm" variant="ghost" onClick={() => beginEdit(d)} aria-label={`Rename ${d.name}`}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setPendingDelete(d)}
                              aria-label={`Delete ${d.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      {/* Delete confirmation — deleting orphans the department_id on any member still in it. */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              Employees currently in this department will keep the assignment until it&apos;s changed.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-department productivity (weights + classification rules). Keyed so switching
          departments remounts the load cycle. Unmounts on close. */}
      {productivityDept ? (
        <DeptProductivitySheet
          key={productivityDept.id}
          department={productivityDept}
          open={true}
          onOpenChange={(o) => !o && setProductivityDept(null)}
        />
      ) : null}
    </Card>
  );
}
