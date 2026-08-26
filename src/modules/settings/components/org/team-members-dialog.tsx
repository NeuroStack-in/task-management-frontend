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
  const [renaming, setRenaming] = useState(false);
  // Re-seed when a DIFFERENT team is opened; the component is reused across rows.
  useEffect(() => setName(teamName), [teamName]);
  /** user_ids with an in-flight add/remove, so a row disables without freezing the dialog. */
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

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

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return everyone
      .filter((e) => !memberIds.has(e.user_id) && e.status !== "deactivated")
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [everyone, memberIds, query]);

  async function add(e: ApiEmployee) {
    setBusyFor(e.user_id, true);
    try {
      const next = await addTeamMembers(teamId, [e.user_id]);
      setMembers(next);
      onCountChange?.(next.length);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 403
          ? "You don't have permission to change team members."
          : "Couldn't add that person.",
      );
    } finally {
      setBusyFor(e.user_id, false);
    }
  }

  async function remove(m: ApiTeamMember) {
    setBusyFor(m.user_id, true);
    try {
      await removeTeamMember(teamId, m.user_id);
      setMembers((cur) => {
        const next = cur.filter((x) => x.user_id !== m.user_id);
        onCountChange?.(next.length);
        return next;
      });
    } catch {
      toast.error("Couldn't remove that person.");
    } finally {
      setBusyFor(m.user_id, false);
    }
  }

  const deptLabel = (id?: string) => (id ? (deptNames.get(id) ?? null) : null);

  async function saveName() {
  const next = name.trim();
  if (!next || next === teamName || renaming) return;
  setRenaming(true);
  try {
    await updateTeam(teamId, { name: next });
    onRenamed?.(next);
    toast.success("Team renamed");
  } catch (e) {
    // Put the old name back — leaving the failed text in the box reads as if it saved.
    setName(teamName);
    toast.error(
      e instanceof ApiError ? e.message : "Couldn't rename the team.",
    );
  } finally {
    setRenaming(false);
  }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[56rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Edit team
          </DialogTitle>
          <DialogDescription>
            Rename the team, and add or remove people. A team can include people from any
            department. Changes save as you make them.
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
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveName();
              }
              if (e.key === "Escape") setName(teamName);
            }}
            disabled={renaming}
            className="h-9"
          />
        </div>

        {loading ? (
          <div className="flex min-h-[16rem] items-center justify-center">
            <Loader label="Loading members…" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* ── Current members ── */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                In the team ({members.length})
              </p>
              <div className="max-h-[26rem] min-h-[16rem] space-y-1 overflow-y-auto rounded-lg border p-1">
                {members.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">
                    No one is in this team yet.
                  </p>
                ) : (
                  members.map((m) => (
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
                        disabled={busy.has(m.user_id)}
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
              <div className="max-h-[22rem] min-h-[12rem] space-y-1 overflow-y-auto rounded-lg border p-1">
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
                      disabled={busy.has(e.user_id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                        busy.has(e.user_id) && "opacity-50",
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
      </DialogContent>
    </Dialog>
  );
}
