"use client";

/**
 * Teams — org structure on the **live backend** (`/v1/teams`, workforce context).
 *
 * A team belongs to a department, so this loads departments too (for the picker + labels). List needs
 * `employees:view`; create / rename / delete need `settings:manage` (server 403 → toast otherwise).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Users, UserCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  listTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  listDepartments,
  type ApiTeam,
  type ApiDepartment,
} from "@/modules/employees/services/employees.service";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

const byName = (a: ApiTeam, b: ApiTeam) => a.name.localeCompare(b.name);

import { TeamMembersDialog } from "./team-members-dialog";

const NO_DEPT = "__none__";

export function TeamsManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add dialog.
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState<string>("");
  const [membersOf, setMembersOf] = useState<ApiTeam | null>(null);
  const [adding, setAdding] = useState(false);

  // Inline rename.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirm.
  const [pendingDelete, setPendingDelete] = useState<ApiTeam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([listTeams(), listDepartments().catch(() => [] as ApiDepartment[])])
      .then(([t, d]) => {
        if (!live) return;
        setTeams([...t].sort(byName));
        setDepts([...d].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load teams."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  const deptName = (id?: string) =>
    id ? (depts.find((d) => d.id === id)?.name ?? "—") : "—";

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      // NONE sentinel = cross-department. Base UI Select treats "" as "unselected", so a real
      // sentinel is needed to distinguish "chose cross-department" from "picked nothing yet".
      const created = await createTeam({
        name,
        department_id: newDept && newDept !== NO_DEPT ? newDept : undefined,
      });
      setTeams((cur) => [...cur, created].sort(byName));
      setNewName("");
      setNewDept("");
      setAddOpen(false);
      toast.success(`“${created.name}” added`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to create teams.");
      } else {
        toast.error(messageOf(e, "Couldn't create the team."));
      }
    } finally {
      setAdding(false);
    }
  }

  function beginEdit(t: ApiTeam) {
    setEditId(t.id);
    setEditName(t.name);
  }

  async function saveEdit() {
    if (!editId) return;
    const name = editName.trim();
    if (!name) return;
    const original = teams.find((t) => t.id === editId);
    if (original && original.name === name) {
      setEditId(null);
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateTeam(editId, { name });
      setTeams((cur) => cur.map((t) => (t.id === editId ? updated : t)).sort(byName));
      setEditId(null);
      toast.success("Team renamed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to rename teams.");
      } else {
        toast.error(messageOf(e, "Couldn't rename the team."));
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTeam(pendingDelete.id);
      setTeams((cur) => cur.filter((t) => t.id !== pendingDelete.id));
      toast.success(`“${pendingDelete.name}” deleted`);
      setPendingDelete(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to delete teams.");
      } else {
        toast.error(messageOf(e, "Couldn't delete the team."));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Teams</CardTitle>
            <CardDescription>
              Teams group people within a department. A team is assigned when an employee joins.
            </CardDescription>
          </div>
          {canManage && !loading && !error ? (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setNewName("");
                setNewDept(depts[0]?.id ?? "");
                setAddOpen(true);
              }}
              disabled={depts.length === 0}
            >
              <Plus className="size-4" /> Add team
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading teams…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams yet"
            description={
              canManage
                ? depts.length === 0
                  ? "Create a department first, then add teams within it."
                  : "Add a team to group people within a department."
                : "No teams have been created for this organization."
            }
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                {editId === t.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="h-8 flex-1"
                      autoFocus
                      disabled={savingEdit}
                      aria-label="Team name"
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
                    <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t.department_id ? deptName(t.department_id) : "Cross-department"}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {t.member_count ?? 0} {(t.member_count ?? 0) === 1 ? "member" : "members"}
                    </span>
                    {canManage ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setMembersOf(t)}
                          aria-label={`Manage members of ${t.name}`}
                          title="Manage members"
                        >
                          <UserCog className="size-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => beginEdit(t)} aria-label={`Rename ${t.name}`}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(t)}
                          aria-label={`Delete ${t.name}`}
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
      </CardContent>

      {/* Add team */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a team</DialogTitle>
            <DialogDescription>
              Name the team. A team can span departments &mdash; leave the department blank for one
              like &ldquo;Workpulse&rdquo; with people from several.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Team name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Platform"
                autoFocus
                disabled={adding}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department (optional)</Label>
              <Select
                value={newDept}
                onValueChange={(v) => setNewDept(v as string)}
                disabled={adding}
                items={Object.fromEntries(depts.map((d) => [d.id, d.name]))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a department…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_DEPT}>No department (cross-department)</SelectItem>
                  {depts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={add} disabled={adding || !newName.trim()}>
              {adding ? "Adding…" : "Add team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members editor */}
      {membersOf ? (
        <TeamMembersDialog
          teamId={membersOf.id}
          teamName={membersOf.name}
          open={!!membersOf}
          onOpenChange={(o) => !o && setMembersOf(null)}
          onCountChange={(count) =>
            setTeams((cur) =>
              cur.map((t) => (t.id === membersOf.id ? { ...t, member_count: count } : t)),
            )
          }
        />
      ) : null}

      {/* Delete confirm */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              Members currently on this team keep the assignment until it&apos;s changed. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
