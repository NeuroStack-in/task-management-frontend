"use client";

/**
 * Who holds a role, and how to move someone out of it — the half the Roles page never showed.
 *
 * Role membership was scattered across three screens: this page defined roles, Employees held the
 * assignment, and Settings → Ownership held owners. The page named after roles could not answer
 * "who is an Admin", which is also why deleting a role failed with "it may still be assigned to
 * someone" and left you no way to find out who.
 *
 * **No new API.** Membership is `useDirectory()` (already cached, `GET /v1/employees`) grouped by
 * `role_id`, and moving someone is the same `assignRole` the employee profile calls.
 *
 * ## Two rules the wording has to carry
 *
 * - **One role per user.** Assigning *moves* someone; they lose the role they had. The action says
 *   "Move to …" for that reason — "Add to" would read as granting a second role, which the model
 *   does not have.
 * - **A JWT is not re-issued on assignment.** The change is live on the server immediately, but the
 *   person's own view updates at their next sign-in. Stated on the panel, not just in the page
 *   header, because here the action looks instant.
 *
 * ## Ownership is not assignable here
 *
 * `assign_role` refuses `role-owner` by design — ownership is granted through `POST /v1/org/owners`,
 * gated on `is_owner` rather than a permission bit, so an Admin holding `roles:manage` genuinely
 * cannot grant it. The Owner row therefore lists its members and links to Settings → Ownership
 * instead of offering a control that would 403. That card also owns the last-owner rule and the
 * `take_role` exit; a second implementation of an irreversible action is how the two drift apart.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { friendlyError } from "@/lib/errors";
import { assignRole, type ApiRole } from "../services/roles.service";
import { grantOwner } from "@/modules/settings/services/org.service";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiEmployee } from "@/modules/employees/services/employees.service";
import { UserAvatar } from "@/components/shared/user-avatar";

/** The system role id ownership rides on — assignable only through Settings → Ownership. */
const ROLE_OWNER = "role-owner";

export function RoleMembers({
  role,
  members,
  roles,
  canManage,
  onChanged,
}: {
  role: ApiRole;
  members: ApiEmployee[];
  /** Every role, for the "Move to …" menu. */
  roles: ApiRole[];
  canManage: boolean;
  /** Re-read the directory after a move, so the counts above stay true. */
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * Ownership is `is_owner` on the caller's own token, not a permission bit — deliberately, so it
   * cannot be granted to a custom role. `roles:manage` is therefore not enough to appoint an owner.
   */
  const callerIsOwner = useAuthStore((st) => st.user?.isOwner === true);

  /**
   * Two destinations, two endpoints.
   *
   * Ownership is not a role assignment: `assign_role` refuses `role-owner` outright, because
   * granting it hands over the whole org. It goes through `POST /v1/org/owners`, which is gated on
   * `is_owner` rather than a permission bit — so an Admin with `roles:manage` can move people
   * between every other role and still cannot create an owner.
   *
   * Both are a *move* from the member's point of view: `grant` sets `role_id = role-owner` as well
   * as adding them to the org's owner set, so the person stops being an Admin either way.
   */
  async function move(person: ApiEmployee, to: ApiRole) {
    const promoting = to.id === ROLE_OWNER;
    setBusy(person.user_id);
    try {
      if (promoting) await grantOwner(person.user_id);
      else await assignRole(person.user_id, to.id);
      toast.success(
        promoting ? `${person.name} is now an owner` : `${person.name} moved to ${to.name}`,
        {
          description: promoting
            ? "Owners have full, unrestricted access. Their own view updates at their next sign-in."
            : "Their own view updates the next time they sign in.",
        },
      );
      onChanged();
    } catch (e) {
      toast.error(
        friendlyError(
          e,
          promoting
            ? "Couldn't make that person an owner."
            : "Couldn't change that person's role.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  if (!members.length) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-sm">
        No one holds this role yet.
        {role.system ? null : " A role with no members can be deleted safely."}
      </p>
    );
  }

  const isOwnerRole = role.id === ROLE_OWNER;
  /**
   * Owner is offered only to a caller who is one — the server gates `POST /v1/org/owners` on
   * `is_owner`, so showing it to an Admin would be a control that always 403s. Filtered here rather
   * than letting the click fail.
   */
  const targets = roles.filter(
    (r) => r.id !== role.id && (r.id !== ROLE_OWNER || callerIsOwner),
  );

  return (
    <div className="bg-muted/30 px-6 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {members.length} {members.length === 1 ? "person holds" : "people hold"} this role
          {canManage && !isOwnerRole ? " · moving someone replaces the role they have now" : ""}
        </p>
        {isOwnerRole ? (
          <Link
            href="/settings/ownership"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            Manage owners in Settings
            <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <ul className="divide-border/60 divide-y">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-2">
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

            {canManage && !isOwnerRole ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === m.user_id}
                      aria-label={`Change ${m.name}'s role`}
                    />
                  }
                >
                  {busy === m.user_id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UserCog className="size-4" />
                  )}
                  Change role
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* A plain element, not `DropdownMenuLabel`. That component wraps Base UI's
                      `Menu.GroupLabel`, which reads context from a `Menu.Group` and **throws when
                      rendered without one** — it crashed the Employees page once already
                      (see pending-invites.tsx). The trigger's aria-label already names the person,
                      so this heading is decorative. */}
                  <div className="text-muted-foreground px-2 py-1.5 text-xs">
                    Move {m.name} to
                  </div>
                  <DropdownMenuSeparator />
                  {targets.map((r) =>
                    r.id === ROLE_OWNER ? (
                      // Set apart, because it is not the same kind of action as the others: it
                      // grants unrestricted access to the whole organisation.
                      <DropdownMenuItem key={r.id} onClick={() => move(m, r)}>
                        <ShieldCheck className="size-4" />
                        Make an owner
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem key={r.id} onClick={() => move(m, r)}>
                        {r.name}
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
