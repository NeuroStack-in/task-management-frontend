/**
 * The Employees directory's filtering, sorting and counting — pure, so the rules the page depends on
 * are tested rather than re-derived in a component (UX audit PEOPLE-04, PEOPLE-05).
 *
 * The roster arrives whole (`readRoster` walks every department partition), so everything here runs
 * client-side over the complete org: a sort or a filter at 150+ people sees everyone, not a page.
 */
import type { EmployeeRow } from "../use-employees";

/**
 * The Status filter. **`active` is the default** and means *working and tracked* — current, signed-in
 * capable, not benched. The bench and leavers have their own rosters under the table, so by default
 * each person appears exactly once on the page.
 *
 * `benched` ("Not tracked") and `deactivated` must never be merged: a benched person still signs in,
 * a deactivated one cannot (see the note on `STATUSES` in the view).
 */
export const DIRECTORY_STATUSES = ["active", "benched", "deactivated", "all"] as const;
export type DirectoryStatus = (typeof DIRECTORY_STATUSES)[number];

/** The department filter's value for people with no department (a name can't be empty). */
export const NO_DEPARTMENT = "__none__";

/** Sortable columns. A leading `-` means descending. */
export const DIRECTORY_SORTS = [
  "name",
  "-name",
  "role",
  "-role",
  "department",
  "-department",
  "productivity",
  "-productivity",
] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];
export type SortKey = "name" | "role" | "department" | "productivity";

export const PAGE_SIZES = ["25", "50", "100"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function sortKeyOf(sort: DirectorySort): { key: SortKey; desc: boolean } {
  const desc = sort.startsWith("-");
  return { key: (desc ? sort.slice(1) : sort) as SortKey, desc };
}

/** Clicking a column: the same column flips direction; a new one starts ascending (scores: highest first). */
export function nextSort(current: DirectorySort, key: SortKey): DirectorySort {
  const { key: k, desc } = sortKeyOf(current);
  if (k === key) return (desc ? key : `-${key}`) as DirectorySort;
  return (key === "productivity" ? "-productivity" : key) as DirectorySort;
}

/** Does this person fall under the status filter? */
export function matchesStatus(e: EmployeeRow, status: DirectoryStatus): boolean {
  switch (status) {
    case "active":
      return e.status === "active" && !e.benched;
    case "benched":
      return e.status === "active" && e.benched;
    case "deactivated":
      return e.status === "deactivated";
    default:
      return true;
  }
}

export function matchesDepartment(e: EmployeeRow, dept: string): boolean {
  if (dept === "all") return true;
  if (dept === NO_DEPARTMENT) return e.department === "";
  return e.department === dept;
}

/**
 * Search across what the directory carries: name, email, employee ID, job title, department and
 * role. Email arrives on the directory row now (`workforce::directory_list`, PEOPLE-04); a server
 * that predates it sends none, and the other fields still match.
 */
export function matchesQuery(e: EmployeeRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [e.name, e.email ?? "", e.empId ?? "", e.jobTitle, e.department, e.roleName].some((f) =>
    f.toLowerCase().includes(q),
  );
}

export interface DirectoryFilters {
  query: string;
  dept: string;
  status: DirectoryStatus;
}

export function filterEmployees(rows: EmployeeRow[], f: DirectoryFilters): EmployeeRow[] {
  return rows.filter(
    (e) =>
      matchesStatus(e, f.status) &&
      matchesDepartment(e, f.dept) &&
      matchesQuery(e, f.query),
  );
}

/**
 * People the search and department would show, but the status filter hides — so a search for a
 * benched or departed person under the default "Active" says where they are instead of "No match".
 */
export function hiddenByStatus(rows: EmployeeRow[], f: DirectoryFilters): number {
  if (f.status === "all" || !f.query.trim()) return 0;
  return rows.filter(
    (e) =>
      !matchesStatus(e, f.status) &&
      matchesDepartment(e, f.dept) &&
      matchesQuery(e, f.query),
  ).length;
}

const byText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/**
 * Sorted copy. Blank values (no role, no department, no score) sort **last in both directions** —
 * a column of dashes at the top of a descending sort hides the people you sorted to find. Ties fall
 * back to the name, so the order is stable and predictable.
 */
export function sortEmployees(rows: EmployeeRow[], sort: DirectorySort): EmployeeRow[] {
  const { key, desc } = sortKeyOf(sort);
  const dir = desc ? -1 : 1;
  const blank = (e: EmployeeRow) =>
    key === "productivity"
      ? e.productivityScore === null
      : key === "role"
        ? !e.roleName
        : key === "department"
          ? !e.department
          : false;
  return [...rows].sort((a, b) => {
    const ab = blank(a);
    const bb = blank(b);
    if (ab !== bb) return ab ? 1 : -1;
    let c = 0;
    if (!ab) {
      if (key === "productivity")
        c = (a.productivityScore ?? 0) - (b.productivityScore ?? 0);
      else if (key === "role") c = byText(a.roleName, b.roleName);
      else if (key === "department") c = byText(a.department, b.department);
      else c = byText(a.name, b.name);
    }
    return c !== 0 ? c * dir : byText(a.name, b.name);
  });
}

/**
 * The headline counts. **Leavers are not employees**: "Total employees" counts current people only
 * (active, benched included) and says how many deactivated people it left out — it used to count
 * them, so the total grew with every departure (PEOPLE-05).
 */
export function directoryStats(rows: EmployeeRow[]) {
  const current = rows.filter((e) => e.status === "active");
  const benched = current.filter((e) => e.benched).length;
  return {
    /** Current employees — active, whether tracked or not. */
    total: current.length,
    /** Current and tracked. */
    tracked: current.length - benched,
    benched,
    deactivated: rows.length - current.length,
  };
}
