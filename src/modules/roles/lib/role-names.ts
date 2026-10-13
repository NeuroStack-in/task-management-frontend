/** The role editor's name limit; a clone it can't then save would be a trap. */
export const ROLE_NAME_MAX = 40;

/**
 * A free name for a copy: "Copy of X", then "Copy of X (2)", … — within {@link ROLE_NAME_MAX}.
 *
 * Role names are unique (case-insensitively) server-side, so a fixed "Copy of X" failed every second
 * clone of the same role with "Try again" (QA audit 2026-10-08, WP-321).
 */
export function cloneName(source: string, existing: readonly { name: string }[]): string {
  const taken = new Set(existing.map((r) => r.name.trim().toLowerCase()));
  const base = `Copy of ${source}`;
  for (let n = 1; n < 1000; n++) {
    const suffix = n === 1 ? "" : ` (${n})`;
    const name = `${base.slice(0, ROLE_NAME_MAX - suffix.length).trimEnd()}${suffix}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return base.slice(0, ROLE_NAME_MAX);
}
