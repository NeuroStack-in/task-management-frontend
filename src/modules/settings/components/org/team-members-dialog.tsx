"use client";

/**
 * Manage the people in one team — **across departments**.
 *
 * A team is org-level now, so the picker is the whole employee directory, not one department's. The
 * left column is the current members (`GET /v1/teams/{id}/members`); the right is everyone else,
 * searchable, tap-to-add. Adds and removes hit the server immediately (both idempotent), so there is
 * no save/discard to get wrong — closing the dialog leaves exactly what is on screen.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, X, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  listTeamMembers,
  updateTeam,
  addTeamMembers,
  removeTeamMember,
  listAllEmployees,
  departmentMap,
  type ApiTeamMember,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";

export function TeamMembersDialog({
  teamId,
  teamName,
  open,
  onOpenChange,
  onCountChange,
  onRenamed,
}: {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** So the row in the parent list can update its member-count badge without a full reload. */
  onCountChange?: (count: number) => void;
  /**
   * Renaming moved in here from an inline input on the row, so the pencil means one thing —
   * "change this team" — instead of the row carrying two different edit affordances.
   */
  onRenamed?: (name: string) => void;
}) {
  const [members, setMembers] = useState<ApiTeamMember[]>([]);
  const [everyone, setEveryone] = useState<ApiEmployee[]>([]);
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [name, setName] = useState(teamName);
  // Re-seed when a DIFFERENT team is opened; the component is reused across rows.
  useEffect(() => setName(teamName), [teamName]);
  /** user_ids with an in-flight add/remove, so a row disables without freezing the dialog. */
  /**
   * Staged membership. Adds and removes used to hit the server on click, which is why this dialog
   * had no Save — there was nothing to save. A Save button on top of immediate writes would be a
   * lie: the work is already done and Cancel could not undo it. So the edits are held here and
   * applied together, which is what makes both buttons mean what they say.
   */
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    // The directory is the whole org — a cross-department team can draw from anywhere. Best-effort:
    // if the directory fails we can still show/remove existing members, just not add new ones.
    Promise.all([
      listTeamMembers(teamId),
      listAllEmployees().catch(() => [] as ApiEmployee[]),
      departmentMap().catch(() => new Map<string, string>()),
    ])
      .then(([m, all, depts]) => {
        if (!live) return;
        setMembers(m);
        setEveryone(all);
        setDeptNames(depts);
      })
      .catch(() => live && toast.error("Couldn't load team members."))
      .finally(() => live && setLoading(false));

  return () => {
      live = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (open) return load();
  }, [open, load]);

  /** What the left column shows: the saved roster, plus staged adds, minus staged removes. */
  const shownMembers = useMemo(() => {
    const kept = members.filter((m) => !pendingRemove.has(m.user_id));
    const added = everyone
      .filter((e) => pendingAdd.has(e.user_id))
      .map((e) => ({
        user_id: e.user_id,
        name: e.name,
        department_id: e.department_id,
      })) as ApiTeamMember[];
    return [...kept, ...added].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, everyone, pendingAdd, pendingRemove]);

  const memberIds = useMemo(
    () => new Set(shownMembers.map((m) => m.user_id)),
    [shownMembers],
  );

  const membershipDirty = pendingAdd.size > 0 || pendingRemove.size > 0;
  const nameDirty = name.trim() !== teamName && name.trim().length > 0;
  const dirty = membershipDirty || nameDirty;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return everyone
      .filter((e) => !memberIds.has(e.user_id) && e.status !== "deactivated")
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [everyone, memberIds, query]);

  function add(e: ApiEmployee) {
    // Re-adding someone staged for removal just cancels the removal — recording both would send a
    // pointless remove+add pair on save.
    if (pendingRemove.has(e.user_id)) {
      setPendingRemove((c) => {
        const n = new Set(c);
        n.delete(e.user_id);
        return n;
      });
      return;
    }
    setPendingAdd((c) => new Set(c).add(e.user_id));
  }

  function remove(m: ApiTeamMember) {
    if (pendingAdd.has(m.user_id)) {
      setPendingAdd((c) => {
        const n = new Set(c);
        n.delete(m.user_id);
        return n;
      });
      return;
    }
    setPendingRemove((c) => new Set(c).add(m.user_id));
  }

  function discard() {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setName(teamName);
  }

  /**
   * Apply everything, then reload from the server rather than trusting local arithmetic.
   *
   * Removes run before adds so a team at a size limit cannot fail on the add half. Each call is
   * idempotent, so a partial failure retried by the user cannot double-apply.
   */
  async function saveAll() {
    if (!dirty || savingAll) return;
    setSavingAll(true);
    try {
      for (const id of pendingRemove) await removeTeamMember(teamId, id);
      if (pendingAdd.size > 0) await addTeamMembers(teamId, [...pendingAdd]);
      if (nameDirty) {
        await updateTeam(teamId, { name: name.trim() });
        onRenamed?.(name.trim());
      }
      const fresh = await listTeamMembers(teamId);
      setMembers(fresh);
      onCountChange?.(fresh.length);
      setPendingAdd(new Set());
      setPendingRemove(new Set());
      toast.success("Team updated");
      onOpenChange(false);
    } catch (err) {
      // Deliberately keep the dialog open and the staged edits intact — discarding someone's work
      // because one call failed is worse than making them press Save again.
      toast.error(
        err instanceof ApiError && err.status === 403
          ? "You don't have permission to change this team."
          : "Couldn't save every change. Nothing was lost — try again.",
      );
    } finally {
      setSavingAll(false);
    }
  }

  const deptLabel = (id?: string) => (id ? (deptNames.get(id) ?? null) : null);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[58rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Edit team
          </DialogTitle>
          <DialogDescription>
            Rename the team, and add or remove people. A team can include people from any
            department. Nothing is applied until you save.
          </DialogDescription>
        </DialogHeader>

        {/* Rename lives here now. It used to be an inline input on the row, which meant the pencil
            and the members icon were two different "edit this" affordances side by side. Saves on
            blur and on Enter — there is no save button in this dialog for anything else, and adding
            one only for the name would imply the rest needed saving too. */}
        <div className="space-y-1.5">
          <label
            htmlFor="team-name"
            className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
          >
            Team name
          </label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveAll();
              }
              if (e.key === "Escape") setName(teamName);
            }}
            disabled={savingAll}
            className="h-9"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[16rem] items-center justify-center">
            <Loader label="Loading members…" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {/* ── Current members ── */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                In the team ({shownMembers.length})
              </p>
              <div className="max-h-[28rem] min-h-[18rem] space-y-1 overflow-y-auto rounded-lg border p-1.5">
                {shownMembers.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">
                    No one is in this team yet.
                  </p>
                ) : (
                  shownMembers.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <UserAvatar
                        userId={m.user_id}
                        name={m.name}
                        className="size-7 shrink-0"
                        fallbackClassName="text-[0.65rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{m.name}</span>
                        {deptLabel(m.department_id) ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {deptLabel(m.department_id)}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => remove(m)}
                        aria-label={`Remove ${m.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Add from the directory ── */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Add people
              </p>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employees…"
                  className="h-9 pl-8"
                  aria-label="Search employees to add"
                />
              </div>
              <div className="max-h-[24rem] min-h-[14rem] space-y-1 overflow-y-auto rounded-lg border p-1.5">
                {candidates.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">
                    {query.trim() ? "No matches." : "Everyone is already in this team."}
                  </p>
                ) : (
                  candidates.map((e) => (
                    <button
                      key={e.user_id}
                      type="button"
                      onClick={() => add(e)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      )}
                    >
                      <UserAvatar
                        userId={e.user_id}
                        name={e.name}
                        className="size-7 shrink-0"
                        fallbackClassName="text-[0.65rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{e.name}</span>
                        {deptLabel(e.department_id) ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {deptLabel(e.department_id)}
                          </span>
                        ) : null}
                      </span>
                      <UserPlus className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Explicit save, because the edits above are staged. Offered only when something changed —
            a permanently-enabled Save on an unchanged dialog trains people to press it for nothing. */}
        <DialogFooter showCloseButton>
          {dirty ? (
            <>
              <span className="text-muted-foreground mr-auto self-center text-xs">
                {[
                  pendingAdd.size ? `${pendingAdd.size} to add` : null,
                  pendingRemove.size ? `${pendingRemove.size} to remove` : null,
                  nameDirty ? "name changed" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <Button variant="ghost" onClick={discard} disabled={savingAll}>
                Discard
              </Button>
              <Button onClick={saveAll} disabled={savingAll}>
                {savingAll ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
