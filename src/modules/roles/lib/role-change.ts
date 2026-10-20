/**
 * What moving someone from one role to another changes for them (UX audit PEOPLE-09).
 *
 * Moving a person to Admin, or to a custom role, was one click with no summary — nothing said that
 * the move handed over screenshots, payroll or role management, or what the person lost on the way.
 * A person holds exactly one role, so a move is a straight swap of one permission set for another:
 * the difference between the two sets is exactly what they gain and lose.
 *
 * Both sides are the sets the server stores (`GET /v1/roles` returns each role's set already closed
 * over `implies`), so no closure is needed here.
 */
import type { ApiRole } from "../services/roles.service";
import { isSensitive, permissionDiff } from "./permission-help";

/** What a role's data scope lets its holder see — said as data, not as the wire value. */
export const SCOPE_LABEL: Record<string, string> = {
  self: "Only their own data",
  team: "Their department's data",
  org: "Everyone's data",
};

const SCOPE_RANK: Record<string, number> = { self: 0, team: 1, org: 2 };

export function scopeLabel(scope: string): string {
  return SCOPE_LABEL[scope] ?? scope;
}

export interface RoleChange {
  /** Permission ids the person gains. */
  added: string[];
  /** Permission ids the person loses. */
  removed: string[];
  /** The gained ids that `permission-help` marks sensitive — named one by one in the confirmation. */
  sensitiveAdded: string[];
  /** The lost ids that are sensitive. */
  sensitiveRemoved: string[];
  /** `null` when the scope stays the same. */
  scope: { from: string; to: string } | null;
  /** The move gives them access they didn't have — a new permission or a wider scope. */
  widens: boolean;
  /** Nothing they can do changes — the two roles grant the same set at the same scope. */
  same: boolean;
  /**
   * The current role wasn't known (a role id the roles list doesn't carry), so `added` is everything
   * the new role grants and nothing is reported as lost — the honest reading of an unknown "before".
   */
  fromUnknown: boolean;
}

/**
 * The difference a move makes. `from` is the role the person holds now, `null` when it couldn't be
 * resolved. Ownership is not handled here — it is `is_owner`, outside the permission set, and has its
 * own confirmation.
 */
export function roleChange(from: ApiRole | null, to: ApiRole): RoleChange {
  const { added, removed } = permissionDiff(from?.permissions ?? [], to.permissions);
  const scopeFrom = from?.scope ?? "";
  const scope = from && scopeFrom !== to.scope ? { from: scopeFrom, to: to.scope } : null;
  const widerScope =
    scope !== null && (SCOPE_RANK[scope.to] ?? 0) > (SCOPE_RANK[scope.from] ?? 0);
  return {
    added,
    removed,
    sensitiveAdded: added.filter(isSensitive),
    sensitiveRemoved: removed.filter(isSensitive),
    scope,
    widens: added.length > 0 || widerScope,
    same: from !== null && added.length === 0 && removed.length === 0 && scope === null,
    fromUnknown: from === null,
  };
}
