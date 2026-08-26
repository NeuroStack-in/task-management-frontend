"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, UserPlus, X, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface EditablePerson {
  user_id: string;
  name: string;
  /** Secondary line — department for a team row, job title for a department row. */
  detail?: string;
}

interface MemberEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** Heading, e.g. "Edit team" / "Edit department". */
  heading: string;
  description: string;
  /** Current name, and a label for its field. Omit `onRename` to make the name read-only. */
  name: string;
  nameLabel: string;
  onRename?: (next: string) => Promise<void>;
  /** Who is in it now. */
  loadMembers: () => Promise<EditablePerson[]>;
  /** Everyone who could be added — already excluding current members. */
  loadCandidates: () => Promise<EditablePerson[]>;
  /** Apply the staged changes. Both are called only for non-empty sets. */
  applyAdd: (userIds: string[]) => Promise<void>;
  applyRemove: (userIds: string[]) => Promise<void>;
  onSaved?: (memberCount: number) => void;
  /** Shown under the candidate column — e.g. the one-department-per-person rule. */
  hint?: string;
}

/**
 * Staged two-column member editor, shared by Teams and Departments.
 *
 * The two differ only in **how** membership is stored — a team keeps `TEAM#` rows and a person can
 * be in several, while a department is a single field on the employee and a person is in exactly
 * one — so the difference lives entirely in the `apply*` callbacks the caller passes. Everything a
 * user sees is the same, which is the point: two lists that behave differently for no visible
 * reason is what made these sections feel unfinished.
 *
 * **Staged, not immediate.** Nothing is written until Save, so Discard can actually undo and the
 * count in the parent row never disagrees with what is on screen. Re-adding someone staged for
 * removal cancels the stage rather than recording both, so Save never sends a pointless
 * remove-then-add pair.
 */
export function MemberEditorDialog({
  open,
  onClose,
  heading,
  description,
  name: initialName,
  nameLabel,
  onRename,
  loadMembers,
  loadCandidates,
  applyAdd,
  applyRemove,
  onSaved,
  hint,
}: MemberEditorDialogProps) {
  const [members, setMembers] = useState<EditablePerson[]>([]);
  const [everyone, setEveryone] = useState<EditablePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [name, setName] = useState(initialName);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(initialName), [initialName]);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    Promise.all([loadMembers(), loadCandidates()])
      .then(([m, c]) => {
        if (!live) return;
        setMembers(m);
        setEveryone(c);
      })
      .catch(() => live && toast.error("Couldn't load the people list."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // The loaders are fresh closures each render; re-running on them would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) return load();
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setQuery("");
  }, [open, load]);

  /** Saved roster, plus staged adds, minus staged removes. */
  const shown = useMemo(() => {
    const kept = members.filter((m) => !pendingRemove.has(m.user_id));
    const added = everyone.filter((e) => pendingAdd.has(e.user_id));
    return [...kept, ...added].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, everyone, pendingAdd, pendingRemove]);

  const shownIds = useMemo(
    () => new Set(shown.map((p) => p.user_id)),
    [shown],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return everyone
      .filter((e) => !shownIds.has(e.user_id))
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [everyone, shownIds, query]);

  const nameDirty =
    Boolean(onRename) && name.trim() !== initialName && name.trim().length > 0;
  const dirty = pendingAdd.size > 0 || pendingRemove.size > 0 || nameDirty;

  function stageAdd(p: EditablePerson) {
    if (pendingRemove.has(p.user_id)) {
      setPendingRemove((c) => {
        const n = new Set(c);
        n.delete(p.user_id);
        return n;
      });
      return;
    }
    setPendingAdd((c) => new Set(c).add(p.user_id));
  }

  function stageRemove(p: EditablePerson) {
    if (pendingAdd.has(p.user_id)) {
      setPendingAdd((c) => {
        const n = new Set(c);
        n.delete(p.user_id);
        return n;
      });
      return;
    }
    setPendingRemove((c) => new Set(c).add(p.user_id));
  }

  function discard() {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setName(initialName);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Removes before adds: a membership limit must not fail on the add half and leave the
      // removes unapplied.
      if (pendingRemove.size > 0) await applyRemove([...pendingRemove]);
      if (pendingAdd.size > 0) await applyAdd([...pendingAdd]);
      if (nameDirty && onRename) await onRename(name.trim());

      const fresh = await loadMembers();
      setMembers(fresh);
      setPendingAdd(new Set());
      setPendingRemove(new Set());
      onSaved?.(fresh.length);
      toast.success("Changes saved");
      onClose();
    } catch (err) {
      // Keep the dialog open with the staged edits intact — throwing away someone's work because
      // one call failed is worse than asking them to press Save again.
      toast.error(
        err instanceof ApiError && err.status === 403
          ? "You don't have permission to change this."
          : "Couldn't save every change. Nothing was lost — try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[58rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> {heading}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {onRename ? (
          <div className="space-y-1.5">
            <label
              htmlFor="entity-name"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              {nameLabel}
            </label>
            <Input
              id="entity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") setName(initialName);
              }}
              disabled={saving}
              className="h-9"
            />
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[18rem] items-center justify-center">
            <Loader label="Loading people…" />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Members ({shown.length})
              </p>
              <div className="max-h-[28rem] min-h-[18rem] space-y-1 overflow-y-auto rounded-lg border p-1.5">
                {shown.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">
                    Nobody here yet. Add someone from the right.
                  </p>
                ) : (
                  shown.map((p) => (
                    <div
                      key={p.user_id}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                        pendingAdd.has(p.user_id) && "bg-success/10",
                      )}
                    >
                      <UserAvatar
                        userId={p.user_id}
                        name={p.name}
                        className="size-7 shrink-0"
                        fallbackClassName="text-[0.65rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.name}</span>
                        {p.detail ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {p.detail}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => stageRemove(p)}
                        aria-label={`Remove ${p.name}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

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
                  aria-label="Search employees"
                />
              </div>
              <div className="max-h-[24rem] min-h-[14rem] space-y-1 overflow-y-auto rounded-lg border p-1.5">
                {candidates.length === 0 ? (
                  <p className="text-muted-foreground p-3 text-sm">
                    {query.trim() ? "No matches." : "Everyone is already here."}
                  </p>
                ) : (
                  candidates.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => stageAdd(p)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <UserAvatar
                        userId={p.user_id}
                        name={p.name}
                        className="size-7 shrink-0"
                        fallbackClassName="text-[0.65rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{p.name}</span>
                        {p.detail ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {p.detail}
                          </span>
                        ) : null}
                      </span>
                      <UserPlus className="text-muted-foreground size-4 shrink-0" />
                    </button>
                  ))
                )}
              </div>
              {hint ? (
                <p className="text-muted-foreground text-xs">{hint}</p>
              ) : null}
            </div>
          </div>
        )}

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
              <Button variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
