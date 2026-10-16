/**
 * `?emp=<user id>` scopes the whole Analytics hub to one employee.
 *
 * The employee profile's **Analytics** button opens `/insights?emp=<id>` (owner request 2026-10-16:
 * one button in place of the separate Location and Screenshots buttons). Every tab reads the same
 * parameter — Activity and AI reports switch to that person's view, Screenshots and Locations open on
 * them — and the tab bar carries it across tabs, so the hub stays on one person until someone picks
 * "Whole organization".
 */
export const EMP_PARAM = "emp";

/** `href` with the employee scope appended, or unchanged when there is none. */
export function withEmp(href: string, emp: string | null | undefined): string {
  if (!emp) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${EMP_PARAM}=${encodeURIComponent(emp)}`;
}
