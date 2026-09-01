"use client";

/**
 * The two pieces every surface needs now that a task can have several assignees: a stack that shows
 * them in the space one avatar used to take, and a picker for choosing them.
 *
 * Both live here rather than in each caller because "how do we render more than one person" is a
 * decision the board card, the list row, the detail dialog and the PDF all have to make the same
 * way — and because the interesting part is what they do when there are *none*. Unassigned is no
 * longer a gap to leave blank: it is how work is offered to the whole project, so it gets a label.
 */
import { useMemo, useState } from "react";
import { ChevronsUpDown, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { initials, personName } from "@/lib/format";
import type { UserMini } from "../lib";
import type { TaskAssignee } from "../types";

/** Sizes that keep the stack aligned with whatever it sits next to. */
const SIZE = {
  sm: { avatar: "size-6", text: "text-[0.6rem]", ring: "ring-2" },
  xs: { avatar: "size-5", text: "text-[0.55rem]", ring: "ring-2" },
} as const;

/**
 * Overlapping avatars for everyone on a task, with the overflow collapsed into `+N`.
 *
 * The ring is what makes a stack readable — without a border in the card's own background colour,
 * three overlapping circles read as one smudge. So the caller passes the surface it sits on.
 */
export function AssigneeStack({
  assignees,
  userMap,
  max = 3,
  size = "sm",
  ringClass = "ring-card",
  className,
}: {
  assignees: TaskAssignee[];
  userMap: Record<string, UserMini | undefined>;
  /** How many faces before the rest collapse into a count. */
  max?: number;
  size?: keyof typeof SIZE;
  /** Tailwind ring colour matching the surface behind the stack. */
  ringClass?: string;
  className?: string;
}) {
  const s = SIZE[size];
  if (assignees.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>Unassigned</span>
    );
  }

  const shown = assignees.slice(0, max);
  const hidden = assignees.slice(max);
  // The full list goes in the tooltip, not just the hidden remainder: someone hovering a stack
  // wants to know who is on it, and reading three faces plus a tooltip of two names is worse than
  // reading one tooltip.
  const everyone = assignees.map((a) => personName(userMap[a.userId]?.name)).join(", ");

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn("flex shrink-0 -space-x-1.5", className)} />}
      >
        {shown.map((a) => {
          const u = userMap[a.userId];
          return (
            <UserAvatar
              key={a.userId}
              userId={a.userId}
              name={personName(u?.name)}
              className={cn(s.avatar, s.ring, ringClass)}
              fallbackClassName={s.text}
            />
          );
        })}
        {hidden.length > 0 ? (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
              s.avatar,
              s.text,
              s.ring,
              ringClass,
            )}
          >
            +{hidden.length}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent>{everyone}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Pick any number of project members.
 *
 * A multi-select rather than a `<Select multiple>` because the trigger has to say something useful
 * when several people are chosen, and because leaving it empty has to read as a deliberate choice
 * ("offer this to the project") rather than an unfilled field.
 *
 * The search box appears only once the list is long enough to need it — a filter over four names is
 * a control that costs a keystroke and saves none.
 */
export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: UserMini[];
  /** Selected user ids, in the order they were picked — the first is served as the legacy single. */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const searchable = members.length > 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || (m.jobTitle ?? "").toLowerCase().includes(q),
    );
  }, [members, query]);

  const chosen = value
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is UserMini => !!m);

  const toggle = (id: string) =>
    // Append rather than insert: the first id is what the server stores as `assignee_id` for
    // clients that only understand one, so "who is this mainly for" stays the order they picked.
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "border-input bg-background ring-offset-background flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm",
          "focus:ring-ring focus:outline-none focus:ring-2 focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {chosen.length === 0 ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            {/* Not "Unassigned": that names a state a task can no longer be saved in, so it read
                as a choice. This is a prompt for the one that has to be made. */}
            <UserPlus className="size-4" /> Choose assignees
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex shrink-0 -space-x-1.5">
              {chosen.slice(0, 3).map((u) => (
                <Avatar key={u.id} className="size-5 ring-2 ring-background">
                  {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                  <AvatarFallback className="text-[0.55rem]">{initials(u.name)}</AvatarFallback>
                </Avatar>
              ))}
            </span>
            <span className="truncate">
              {chosen.length === 1
                ? chosen[0].name
                : `${chosen[0].name} +${chosen.length - 1}`}
            </span>
          </span>
        )}
        <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="max-h-72 overflow-y-auto"
      >
        {/* A plain element, not `DropdownMenuLabel` — the third place to need this note.
            That component wraps Base UI's `Menu.GroupLabel`, which reads context from a
            `Menu.Group` and **throws when rendered without one**, taking the whole page down
            through the error boundary. It has now crashed the Employees page (pending-invites.tsx),
            the Roles page (role-members.tsx) and this one. Doubly wrong here anyway: a group label
            is not a container for the interactive Clear button. */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs font-medium">
          <span>Assignees</span>
          {value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="font-normal text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>

        {searchable ? (
          <div className="px-1.5 pb-1.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="h-8"
              // Typing must reach the input rather than being swallowed as menu type-ahead, which
              // would jump the highlight around and never filter anything.
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}

        <DropdownMenuSeparator />

        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No members match.
          </p>
        ) : (
          filtered.map((u) => (
            <DropdownMenuCheckboxItem
              key={u.id}
              checked={value.includes(u.id)}
              // Keep the menu open: picking three people should be three clicks, not three
              // open-pick-reopen cycles.
              closeOnClick={false}
              onCheckedChange={() => toggle(u.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar className="size-6">
                  {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                  <AvatarFallback className="text-[0.6rem]">{initials(u.name)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm">{u.name}</span>
                  {u.jobTitle ? (
                    <span className="truncate text-xs text-muted-foreground">{u.jobTitle}</span>
                  ) : null}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A single "who put them on this, and when" line. Rendered only when the server recorded it. */
export function AssignedByLine({
  assignee,
  userMap,
}: {
  assignee: TaskAssignee;
  userMap: Record<string, UserMini | undefined>;
}) {
  // Assignments made before the server recorded this carry an empty `assignedBy`. Saying nothing
  // beats "Assigned by —", and beats guessing that the task's creator did it.
  if (!assignee.assignedBy) return null;
  const by = personName(userMap[assignee.assignedBy]?.name);
  return (
    <span className="truncate text-xs text-muted-foreground">
      Assigned by {by}
      {assignee.assignedAt > 0 ? (
        <>
          {" · "}
          {new Date(assignee.assignedAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
        </>
      ) : null}
    </span>
  );
}
