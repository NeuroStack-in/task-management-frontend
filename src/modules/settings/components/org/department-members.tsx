"use client";

/**
 * Who is in a department, and how to move them to another — the Roles page's member list, for
 * departments (owner request 2026-10-16).
 *
 * **No new API.** Membership is the roster the Departments card already reads, grouped by
 * `department_id`; a move is the same `PATCH /v1/employees/{id}` the edit dialog sends.
 *
 * - **One department per person.** Moving someone takes them out of this department — the action
 *   says "Move to …" for that reason, as Roles does.
 * - **Several at once.** A reorganisation moves people in groups, so members can be ticked and moved
 *   together. Writes go one at a time: `apiFetch` never retries a write, and a parallel burst against
 *   the gateway's throttle would drop some silently.
 * - **Moves need `employees:manage`** (a move is an employee update), not `departments:manage`.
 */
import { useMemo, useState } from "react";
import { ArrowRightLeft, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import { friendlyError } from "@/lib/errors";
import {
  updateEmployee,
  type ApiDepartment,
  type ApiEmployee,
} from "@/modules/employees/services/employees.service";

export function DepartmentMembers({
  department,
  members,
  departments,
  canMove,
  onMoved,
}: {
  department: ApiDepartment;
  members: ApiEmployee[];
  /** Every department, for the "Move to …" menus. */
  departments: ApiDepartment[];
  canMove: boolean;
  /** Called once per person actually moved, so the counts above follow at once. */
  onMoved: (userId: string, toDepartmentId: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** The people a move is running for — their controls are disabled meanwhile. */
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const targets = useMemo(
    () => departments.filter((d) => d.id !== department.id),
    [departments, department.id],
  );
  const sorted = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  async function move(people: ApiEmployee[], to: ApiDepartment) {
    setBusy(new Set(people.map((p) => p.user_id)));
    const moved: ApiEmployee[] = [];
    let failure: unknown = null;
    for (const p of people) {
      try {
        await updateEmployee(p.user_id, { department_id: to.id });
        moved.push(p);
        onMoved(p.user_id, to.id);
      } catch (e) {
        failure = e;
        break; // stop at the first refusal rather than repeat it for everyone left
      }
    }
    setBusy(new Set());
    setSelected((s) => {
      const next = new Set(s);
      for (const p of moved) next.delete(p.user_id);
      return next;
    });
    if (moved.length) {
      toast.success(
        moved.length === 1
          ? `${moved[0].name} moved to ${to.name}`
          : `${moved.length} people moved to ${to.name}`,
      );
    }
    if (failure) {
      const left = people.length - moved.length;
      toast.error(
        friendlyError(failure, "Couldn't move that person."),
        left > 1 ? { description: `${left} people were not moved.` } : undefined,
      );
    }
  }

  if (!members.length) {
    return (
      <p className="text-muted-foreground px-4 py-4 text-sm">
        No one is in {department.name} yet. Move people here from another department.
      </p>
    );
  }

  const chosen = sorted.filter((m) => selected.has(m.user_id));
  const allChosen = chosen.length === sorted.length;

  return (
    <div className="space-y-2 px-4 py-3">
      {canMove && targets.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <Checkbox
              checked={allChosen}
              indeterminate={chosen.length > 0 && !allChosen}
              onCheckedChange={(on) =>
                setSelected(on ? new Set(sorted.map((m) => m.user_id)) : new Set())
              }
              aria-label={`Select everyone in ${department.name}`}
            />
            {chosen.length
              ? `${chosen.length} selected`
              : "Select people to move several at once"}
          </label>
          {chosen.length ? (
            <MoveMenu
              label={`Move ${chosen.length} to…`}
              ariaLabel={`Move ${chosen.length} selected ${chosen.length === 1 ? "person" : "people"} to another department`}
              heading={`${chosen.length} selected`}
              targets={targets}
              busy={busy.size > 0}
              onPick={(to) => void move(chosen, to)}
            />
          ) : null}
        </div>
      ) : null}

      <ul className="divide-border/60 divide-y">
        {sorted.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-2">
            {canMove && targets.length ? (
              <Checkbox
                checked={selected.has(m.user_id)}
                onCheckedChange={(on) => toggle(m.user_id, on === true)}
                disabled={busy.has(m.user_id)}
                aria-label={`Select ${m.name}`}
              />
            ) : null}
            <UserAvatar
              userId={m.user_id}
              name={m.name}
              className="size-7 shrink-0"
              fallbackClassName="text-[11px]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              {m.title ? (
                <p className="text-muted-foreground truncate text-xs">{m.title}</p>
              ) : null}
            </div>
            {canMove && targets.length ? (
              <MoveMenu
                label="Change department"
                ariaLabel={`Change ${m.name}'s department`}
                heading={m.name}
                targets={targets}
                busy={busy.has(m.user_id)}
                onPick={(to) => void move([m], to)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {canMove && !targets.length ? (
        <p className="text-muted-foreground text-xs">
          Add another department to move people between them.
        </p>
      ) : null}
    </div>
  );
}

function MoveMenu({
  label,
  ariaLabel,
  heading,
  targets,
  busy,
  onPick,
}: {
  label: string;
  ariaLabel: string;
  heading: string;
  targets: ApiDepartment[];
  busy: boolean;
  onPick: (to: ApiDepartment) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={busy} aria-label={ariaLabel} />
        }
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRightLeft className="size-4" />
        )}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* A plain element, not `DropdownMenuLabel`: that wraps `Menu.GroupLabel`, which throws
            outside a `Menu.Group` (see role-members.tsx). */}
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wide uppercase">
            Move to
          </p>
          <p className="truncate text-sm font-medium">{heading}</p>
        </div>
        <DropdownMenuSeparator />
        {targets.map((d) => (
          <DropdownMenuItem key={d.id} onClick={() => onPick(d)} className="gap-2">
            <Building2 className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate">{d.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
