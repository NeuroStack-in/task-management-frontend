/**
 * The Analytics hub's shared query parameters (UX audit 2026-10-16, MON-13).
 *
 * Every tab used to open on today with every department, and switching tabs threw away the day and
 * the department the reader had picked — so following "who was low on the 14th" from AI reports to
 * Screenshots meant picking the 14th again, by hand. Now the day and the department live in the URL
 * (`?date=YYYY-MM-DD&dept=<id>`), each tab reads them, and the tab bar carries them across. A link
 * to a tab therefore opens the same slice, and a reload keeps it.
 *
 * Pure helpers here; the React side is `use-insights-params.ts`.
 */
import { EMP_PARAM } from "./employee-scope";

/** `?date=` — the day every tab shows. Absent means today. */
export const DATE_PARAM = "date";

/** `?dept=` — a department id. Absent means every department. */
export const DEPT_PARAM = "dept";

/** The parameters the tab bar carries from one tab to the next. */
export const CARRIED_PARAMS = [EMP_PARAM, DATE_PARAM, DEPT_PARAM] as const;

/** A `?date=` worth honouring: a real `YYYY-MM-DD` that isn't after `today`. */
export function validDateParam(v: string | null | undefined, today: string): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v > today) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // `Date` rolls 2026-02-31 over to March — a date that doesn't exist is not honoured.
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** A `?dept=` worth honouring: any non-empty id that isn't the "all" sentinel. */
export function validDeptParam(v: string | null | undefined): v is string {
  return !!v && v !== "all" && v.length <= 128;
}

/**
 * `href` with the hub's carried parameters (employee, day, department) copied from `current`.
 * Anything else in `current` (`?show=review`, a hash) belongs to the page it was on, so it isn't.
 */
export function withCarriedParams(href: string, current: URLSearchParams | null): string {
  if (!current) return href;
  const [path, existing = ""] = href.split("?");
  const q = new URLSearchParams(existing);
  for (const key of CARRIED_PARAMS) {
    const v = current.get(key);
    if (v && !q.has(key)) q.set(key, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * `search` with each key set (or, for `null`, removed) — the next query string, `?`-prefixed, or
 * `""` when nothing is left.
 */
export function nextSearch(search: string, update: Record<string, string | null>): string {
  const q = new URLSearchParams(search);
  for (const [k, v] of Object.entries(update)) {
    if (v) q.set(k, v);
    else q.delete(k);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
