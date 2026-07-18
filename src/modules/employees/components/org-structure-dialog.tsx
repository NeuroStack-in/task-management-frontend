"use client";

/**
 * Departments & teams administration (`workforce` context, LLD §6).
 *
 * Renames go to `PATCH /v1/departments/{id}` / `PATCH /v1/teams/{id}`; removals to the matching
 * `DELETE`. All four are gated server-side on `org:manage`; the caller only opens this when the
 * signed-in role holds `employees:manage` (the frontend id for that bit — see the service).
 *
 * Creating departments/teams isn't offered here: teams are minted through the employee flows, and a
 * bare create form would be a dead end next to the delete guard below.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Check, Pencil, Trash2, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { useOrgStructure } from "../use-org-structure";

/** What a pending delete confirmation is about. */
interface DeleteTarget {
  kind: "department" | "team";
  id: string;
  name: string;
  /** Teams that would be orphaned — departments only. Non-zero means the server will 409. */
  teamCount: number;
}

/** One editable row: reads as text, swaps to an input while being renamed. */
function StructureRow({
  icon: Icon,
  name,
  meta,
  indented,
  busy,
  onRename,
  onDelete,
}: {
  icon: typeof Building2;
  name: string;
  meta?: string;
  indented?: boolean;
  busy: boolean;
  onRename: (name: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(name);
    setEditing(true);
  };

  const save = async () => {
    const next = draft.trim();
    // The server rejects a blank department name (400) and silently ignores a blank team name —
    // neither is a useful outcome, so stop here instead.
    if (!next) {
      toast.error("Name can't be empty.");
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={
        indented
          ? "flex items-center gap-2 border-t py-2 pr-2 pl-9"
          : "flex items-center gap-2 px-2 py-2"
      }
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      {editing ? (
        <>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-7 flex-1"
            aria-label={`Rename ${name}`}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Save name"
            disabled={saving}
            onClick={() => void save()}
          >
            <Check className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Cancel rename"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            <X className="size-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          {meta ? (
            <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Rename ${name}`}
            disabled={busy}
            onClick={start}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Delete ${name}`}
            disabled={busy}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

export function OrgStructureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    departments,
    teams,
    loading,
    error,
    reload,
    renameDept,
    removeDept,
    renameTeamById,
    removeTeam,
  } = useOrgStructure(open);
  const [pending, setPending] = useState<DeleteTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const teamsOf = (deptId: string) => teams.filter((t) => t.department_id === deptId);
  // Teams whose department_id no longer resolves. They'd otherwise be invisible here.
  const orphanTeams = teams.filter(
    (t) => !departments.some((d) => d.id === t.department_id),
  );

  const fail = (e: unknown, fallback: string) =>
    toast.error(e instanceof ApiError ? e.message : fallback);

  const rename = async (kind: DeleteTarget["kind"], id: string, name: string) => {
    try {
      await (kind === "department" ? renameDept(id, name) : renameTeamById(id, name));
      toast.success(`Renamed to “${name}”.`);
    } catch (e) {
      fail(e, `Couldn't rename the ${kind}. Try again.`);
      throw e;
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await (pending.kind === "department"
        ? removeDept(pending.id)
        : removeTeam(pending.id));
      toast.success(`“${pending.name}” deleted.`);
      setPending(null);
    } catch (e) {
      fail(e, `Couldn't delete the ${pending.kind}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPending(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {pending ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete {pending.kind}?</DialogTitle>
              <DialogDescription>
                {pending.kind === "department" && pending.teamCount > 0 ? (
                  <>
                    <span className="font-medium text-foreground">{pending.name}</span> still has{" "}
                    {pending.teamCount} {pending.teamCount === 1 ? "team" : "teams"}. Departments
                    with teams can&apos;t be deleted — move or delete those teams first.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{pending.name}</span> will be
                    removed permanently. This can&apos;t be undone.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={
                  busy || (pending.kind === "department" && pending.teamCount > 0)
                }
                onClick={() => void confirmDelete()}
              >
                {busy ? "Deleting…" : `Delete ${pending.kind}`}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Departments &amp; teams</DialogTitle>
              <DialogDescription>
                Rename or remove the org&apos;s departments and the teams inside them.
              </DialogDescription>
            </DialogHeader>

            {loading && departments.length === 0 ? (
              <Loader label="Loading structure…" />
            ) : error ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" onClick={reload}>
                  Retry
                </Button>
              </div>
            ) : departments.length === 0 && orphanTeams.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No departments yet"
                description="Departments appear here once your organization has them."
                className="border-dashed"
              />
            ) : (
              <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                {departments.map((d) => {
                  const deptTeams = teamsOf(d.id);
                  return (
                    <div key={d.id} className="rounded-lg border">
                      <StructureRow
                        icon={Building2}
                        name={d.name}
                        meta={
                          deptTeams.length
                            ? `${deptTeams.length} ${deptTeams.length === 1 ? "team" : "teams"}`
                            : undefined
                        }
                        busy={busy}
                        onRename={(name) => rename("department", d.id, name)}
                        onDelete={() =>
                          setPending({
                            kind: "department",
                            id: d.id,
                            name: d.name,
                            teamCount: deptTeams.length,
                          })
                        }
                      />
                      {deptTeams.map((t) => (
                        <StructureRow
                          key={t.id}
                          icon={Users}
                          name={t.name}
                          indented
                          busy={busy}
                          onRename={(name) => rename("team", t.id, name)}
                          onDelete={() =>
                            setPending({
                              kind: "team",
                              id: t.id,
                              name: t.name,
                              teamCount: 0,
                            })
                          }
                        />
                      ))}
                    </div>
                  );
                })}

                {orphanTeams.length > 0 ? (
                  <div className="rounded-lg border border-dashed">
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Teams whose department no longer exists
                    </p>
                    {orphanTeams.map((t) => (
                      <StructureRow
                        key={t.id}
                        icon={Users}
                        name={t.name}
                        indented
                        busy={busy}
                        onRename={(name) => rename("team", t.id, name)}
                        onDelete={() =>
                          setPending({
                            kind: "team",
                            id: t.id,
                            name: t.name,
                            teamCount: 0,
                          })
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <DialogFooter showCloseButton />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
