import type { User } from "@/types/user";
import type { RoleScope } from "@/types/rbac";

type MinUser = Pick<User, "id" | "department" | "team">;

/**
 * The set of user ids a given role+user may see, based on the role's data scope:
 * - `org`  → `null` (everyone; no restriction).
 * - `team` → everyone in the same department + team as the user.
 * - `self` → only the user themselves.
 *
 * Callers filter their datasets (which all carry a user id) against this set.
 */
export function scopedUserIds(
  user: MinUser | null | undefined,
  scope: RoleScope,
  all: MinUser[],
): Set<string> | null {
  if (!user) return new Set<string>();
  if (scope === "org") return null;
  if (scope === "self") return new Set([user.id]);
  return new Set(
    all
      .filter((u) => u.department === user.department && u.team === user.team)
      .map((u) => u.id),
  );
}
