"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/shared/loader";
import { UserAvatar } from "@/components/shared/user-avatar";

export interface PersonRow {
  user_id: string;
  name: string;
  /** Secondary line — a department for a team member, a job title for a department member. */
  detail?: string;
}

interface EntityPeopleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title: what this thing is. */
  subtitle?: string;
  /** Extra key/value facts shown above the roster (department, created date, …). */
  facts?: { label: string; value: string }[];
  /** Resolves the roster. Called on open; a rejection renders an honest error, never a crash. */
  load: () => Promise<PersonRow[]>;
  emptyLabel?: string;
}

/**
 * **Read-only** detail for a team or a department: what it is, and who is in it.
 *
 * The pencil on those rows used to flip the row into an inline rename box, which meant the only way
 * to look at a team was to open the thing that could change it — and it showed nothing you could not
 * already see in the row. This is the "look" half; the pencil is now unambiguously "change".
 *
 * Deliberately dumb about *where* the people come from: a team fetches its own members, a department
 * filters the directory. One dialog, two callers, no branching on entity type inside it.
 */
export function EntityPeopleDialog({
  open,
  onClose,
  title,
  subtitle,
  facts,
  load,
  emptyLabel = "Nobody is in this yet.",
}: EntityPeopleDialogProps) {
  const [people, setPeople] = useState<PersonRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // Clear on close so reopening a DIFFERENT team never flashes the previous one's roster.
      setPeople(null);
      setError(null);
      return;
    }
    let live = true;
    load()
      .then((rows) => live && setPeople(rows))
      .catch(() => live && setError("Couldn't load the people in this."));
    return () => {
      live = false;
    };
    // `load` is a fresh closure each render; keying on `open` alone is what stops a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            {title}
          </DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>

        {facts && facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-muted-foreground text-xs">{f.label}</dt>
                <dd className="truncate font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            People {people ? `(${people.length})` : ""}
          </p>
          <div className="max-h-[22rem] min-h-[8rem] space-y-1 overflow-y-auto rounded-lg border p-1">
            {error ? (
              <p className="text-muted-foreground p-3 text-sm">{error}</p>
            ) : people === null ? (
              <div className="flex min-h-[8rem] items-center justify-center">
                <Loader label="Loading…" />
              </div>
            ) : people.length === 0 ? (
              <p className="text-muted-foreground p-3 text-sm">{emptyLabel}</p>
            ) : (
              people.map((p) => (
                <div
                  key={p.user_id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
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
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
