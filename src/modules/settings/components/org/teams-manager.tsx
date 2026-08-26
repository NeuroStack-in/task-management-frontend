"use client";

/**
 * Teams — org structure on the **live backend** (`/v1/teams`, workforce context).
 *
 * List needs `employees:view`; create / rename / delete and **membership** need `settings:manage`
 * (server 403 → toast otherwise).
 *
 * **Teams are cross-department by design.** A team is a working group, not a slice of the org chart:
 * it owns no department, and a person can be in several at once. Membership lives entirely in the
 * `TEAM#` rows the members endpoints maintain — nothing here writes `employee.team_id`, so a team
 * roster has exactly one source of truth. Departments are the other axis and are edited in their own
 * section.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listAllEmployees,
  listTeamMembers,
  addTeamMembers,
  removeTeamMember,
  type ApiTeam,
  type ApiDepartment,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";
import { EntityPeopleDialog } from "./entity-people-dialog";
import { MemberEditorDialog } from "./member-editor-dialog";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export function TeamsManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [teams, setTeams] = useState<ApiTeam[]>([]);
  /** Departments are still loaded — not to own a team, but to label each *person* with theirs, which
   *  is the useful thing to see when picking members for a cross-department group. */
  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  const [people, setPeople] = useState<ApiEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [viewing, setViewing] = useState<ApiTeam | null>(null);
  const [editing, setEditing] = useState<ApiTeam | null>(null);

  const [pendingDelete, setPendingDelete] = useState<ApiTeam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    // Teams are the page; departments and the directory are enrichment for the member picker, so
    // either failing degrades a label rather than blanking the section.
    Promise.all([
      listTeams(),
      listDepartments().catch(() => [] as ApiDepartment[]),
      listAllEmployees().catch(() => [] as ApiEmployee[]),
    ])
      .then(([t, d, e]) => {
        if (!live) return;
        setTeams([...t].sort(byName));
        setDepts([...d].sort(byName));
        setPeople(e);
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

  const deptName = useCallback(
    (id?: string) => (id ? (depts.find((d) => d.id === id)?.name ?? "—") : "No department"),
    [depts],
  );

  /** Everyone, labelled with their own department — the candidate pool for every team. */
  const directory = useMemo(
    () =>
      people.map((e) => ({
        user_id: e.user_id,
        name: e.name,
        detail: deptName(e.department_id),
      })),
    [people, deptName],
  );

  async function add() {
    const name = newName.trim();
    if (!name) return;
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error("A team with that name already exists.");
      return;
    }
    setAdding(true);
    try {
      // No `department_id`: a team never belongs to one. The field survives on older rows and is
      // simply not read — see the header note about a single source of truth.
      const created = await createTeam({ name });
      setTeams((cur) => [...cur, created].sort(byName));
      setNewName("");
      setAddOpen(false);
      toast.success(`“${created.name}” added`);
      // Straight into the roster: a team with no people in it is not yet a team.
      setEditing(created);
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
              Working groups that cut across departments. Someone can be in as many teams as they
              need.
            </CardDescription>
          </div>
          {canManage && !loading && !error ? (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                setNewName("");
                setAddOpen(true);
              }}
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
                ? "Add a team to group people from any department around a piece of work."
                : "No teams have been created for this organization."
            }
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {teams.map((t) => {
              const count = t.member_count ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">Cross-department</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                    {count} {count === 1 ? "member" : "members"}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setViewing(t)}
                    aria-label={`View ${t.name}`}
                    title="View team"
                  >
                    <Eye className="size-3.5" />
                  </Button>
                  {canManage ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.name}`}
                        title="Rename and edit members"
                      >
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
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Add team — name only. */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a team</DialogTitle>
            <DialogDescription>
              Name the team &mdash; you&apos;ll pick its members next. Teams span departments, so
              there&apos;s nothing else to choose.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Team name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Platform"
              autoFocus
              disabled={adding}
            />
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

      {viewing ? (
        <EntityPeopleDialog
          open
          onClose={() => setViewing(null)}
          title={viewing.name}
          subtitle="Who is in this team. Use the pencil to change it."
          facts={[
            { label: "Scope", value: "Cross-department" },
            { label: "Members", value: String(viewing.member_count ?? 0) },
          ]}
          load={async () =>
            (await listTeamMembers(viewing.id))
              .sort(byName)
              .map((m) => ({
                user_id: m.user_id,
                name: m.name,
                detail: deptName(m.department_id),
              }))
          }
          emptyLabel="No one is in this team yet."
        />
      ) : null}

      {editing ? (
        <MemberEditorDialog
          open
          onClose={() => setEditing(null)}
          heading={`Edit ${editing.name}`}
          description="Rename the team and choose who's in it. Anyone can join, from any department."
          name={editing.name}
          nameLabel="Team name"
          onRename={async (next) => {
            const updated = await updateTeam(editing.id, { name: next });
            setTeams((cur) =>
              cur.map((t) => (t.id === editing.id ? { ...t, ...updated } : t)).sort(byName),
            );
          }}
          loadMembers={async () =>
            (await listTeamMembers(editing.id)).map((m) => ({
              user_id: m.user_id,
              name: m.name,
              detail: deptName(m.department_id),
            }))
          }
          loadCandidates={async () => directory}
          // The add endpoint takes the whole set in one call; removal is per-person, so that one
          // loops. Writes are never retried by `apiFetch`, hence sequential rather than a burst.
          applyAdd={(ids) => addTeamMembers(editing.id, ids).then(() => undefined)}
          applyRemove={async (ids) => {
            for (const id of ids) await removeTeamMember(editing.id, id);
          }}
          onSaved={(count) =>
            setTeams((cur) =>
              cur.map((t) => (t.id === editing.id ? { ...t, member_count: count } : t)),
            )
          }
          hint="A person can be in several teams — adding them here doesn't remove them from another."
        />
      ) : null}

      {/* Delete confirm */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>
              The {pendingDelete?.member_count ?? 0} people in it stay in their departments and in any
              other teams. This can&apos;t be undone.
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
