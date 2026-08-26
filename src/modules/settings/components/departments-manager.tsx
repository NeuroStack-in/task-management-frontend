"use client";

/**
 * Department management — on the **live backend** (`/v1/departments`, workforce context).
 *
 * List needs `employees:view`; create / rename / delete and **membership** need `settings:manage`
 * (backend `OrgManage` / `employees:manage`). Lives on the Organization settings page because
 * departments are org structure.
 *
 * A department is a **roster you edit here**, not just a name in a picker. Membership is a single
 * field on the employee (`department_id`), so a person is in exactly one department and adding them
 * to a second **moves** them out of the first — enforced by the data model, not by a check in this
 * file, and the editor says so before you press Save.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, SlidersHorizontal, Eye } from "lucide-react";
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
  listAllEmployees,
  createDepartment,
  updateDepartment,
  updateEmployee,
  deleteDepartment,
  type ApiDepartment,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import { EntityPeopleDialog } from "./org/entity-people-dialog";
import { DeptProductivityDialog } from "./org/dept-productivity-dialog";
import { MemberEditorDialog } from "./org/member-editor-dialog";

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

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export function DepartmentsManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  /**
   * The whole directory, held once: it supplies both the per-row counts and the editor's roster, so
   * opening a department costs no extra request and the count on the row can never disagree with the
   * list inside it.
   */
  const [people, setPeople] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [editing, setEditing] = useState<ApiDepartment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiDepartment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [productivityDept, setProductivityDept] = useState<ApiDepartment | null>(null);
  const [viewing, setViewing] = useState<ApiDepartment | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    // Departments are the page; the directory is enrichment. A directory failure degrades the counts
    // to zero rather than blanking the section, so a viewer without `employees:view` still sees the
    // structure.
    Promise.all([listDepartments(), listAllEmployees().catch(() => [] as ApiEmployee[])])
      .then(([d, e]) => {
        if (!live) return;
        setDepts([...d].sort(byName));
        setPeople(e);
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

  const refreshPeople = useCallback(async () => {
    const fresh = await listAllEmployees();
    setPeople(fresh);
    return fresh;
  }, []);

  const countOf = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of people) {
      if (p.department_id) counts.set(p.department_id, (counts.get(p.department_id) ?? 0) + 1);
    }
    return counts;
  }, [people]);

  const deptName = useCallback(
    (id?: string) => (id ? (depts.find((d) => d.id === id)?.name ?? "—") : "No department"),
    [depts],
  );

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
      setDepts((cur) => [...cur, created].sort(byName));
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
      setDepts((cur) => [...cur, ...created].sort(byName));
      toast.success(`Added ${created.length} department${created.length === 1 ? "" : "s"}`);
    }
    if (failed) toast.error(`${failed} couldn't be added — you can add them manually.`);
    setSeeding(false);
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

  const pendingDeleteCount = pendingDelete ? (countOf.get(pendingDelete.id) ?? 0) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>
          Who belongs to each part of the org. Everyone is in exactly one department &mdash; adding
          someone here moves them out of their current one.
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
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {canManage ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
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
                  <Button
                    variant="outline"
                    onClick={seedDefaults}
                    disabled={seeding}
                    className="mb-4"
                  >
                    {seeding ? "Adding…" : "Add the standard set"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border">
                {depts.map((d) => {
                  const count = countOf.get(d.id) ?? 0;
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm font-medium">{d.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                        {count} {count === 1 ? "member" : "members"}
                      </span>
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
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setViewing(d)}
                        aria-label={`View ${d.name}`}
                        title="View department"
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setEditing(d)}
                            aria-label={`Edit ${d.name}`}
                            title="Rename and edit members"
                          >
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
                    </li>
                  );
                })}
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
              {pendingDeleteCount > 0
                ? `${pendingDeleteCount} ${pendingDeleteCount === 1 ? "person is" : "people are"} in this department and will be left without one. `
                : ""}
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

      {viewing ? (
        <EntityPeopleDialog
          open
          onClose={() => setViewing(null)}
          title={viewing.name}
          subtitle="Everyone assigned to this department."
          facts={[{ label: "Members", value: String(countOf.get(viewing.id) ?? 0) }]}
          load={async () =>
            people
              .filter((e) => e.department_id === viewing.id)
              .sort(byName)
              .map((e) => ({ user_id: e.user_id, name: e.name, detail: e.title }))
          }
          emptyLabel="Nobody is assigned to this department yet."
        />
      ) : null}

      {editing ? (
        <MemberEditorDialog
          open
          onClose={() => setEditing(null)}
          heading={`Edit ${editing.name}`}
          description="Rename the department and choose who belongs to it."
          name={editing.name}
          nameLabel="Department name"
          onRename={async (next) => {
            const updated = await updateDepartment(editing.id, next);
            setDepts((cur) => cur.map((d) => (d.id === editing.id ? updated : d)).sort(byName));
          }}
          loadMembers={async () =>
            (await refreshPeople())
              .filter((e) => e.department_id === editing.id)
              .map((e) => ({ user_id: e.user_id, name: e.name, detail: e.title }))
          }
          loadCandidates={async () =>
            people
              .filter((e) => e.department_id !== editing.id)
              .map((e) => ({
                user_id: e.user_id,
                name: e.name,
                // Their CURRENT department, so "this will move them" is visible before you click.
                detail: deptName(e.department_id),
              }))
          }
          applyAdd={async (ids) => {
            // Sequential: these are writes, which `apiFetch` never retries, so a parallel burst
            // against the gateway's throttle would drop some of them silently.
            for (const id of ids) await updateEmployee(id, { department_id: editing.id });
          }}
          applyRemove={async (ids) => {
            // "" clears the field — the server contract for these string columns.
            for (const id of ids) await updateEmployee(id, { department_id: "" });
          }}
          hint="Everyone belongs to one department. Adding someone already in another moves them here."
        />
      ) : null}

      {/* Per-department productivity (weights + classification rules). Keyed so switching
          departments remounts the load cycle. Unmounts on close. */}
      {productivityDept ? (
        <DeptProductivityDialog
          key={productivityDept.id}
          department={productivityDept}
          open={true}
          onOpenChange={(o) => !o && setProductivityDept(null)}
        />
      ) : null}
    </Card>
  );
}
