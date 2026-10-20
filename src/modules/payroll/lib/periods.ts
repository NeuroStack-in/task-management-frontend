/**
 * Pay periods (`YYYY-MM`) for the draft picker (UX audit 2026-10-16, TIME-20).
 *
 * Drafting used to take a free-text "YYYY-MM": easy to mistype, and a typo either failed or drafted
 * the wrong month (a run can't be deleted). A list of real months removes the format from the job.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The month `offset` months from `now`'s, as `YYYY-MM`, in the viewer's calendar. */
export function periodOf(now: Date, offset = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * The month most likely being paid: the last one that has **ended**. Only an ended month can be
 * finalized (owner decision 2026-10-17), so it is the sensible default.
 */
export function lastCompletedPeriod(now: Date): string {
  return periodOf(now, -1);
}

/**
 * The current month and the `count - 1` before it, newest first. The current month stays on offer:
 * drafting it is a preview (its hours are still coming in), and the page says it can't be finalized
 * yet. Future months are not offered — there is nothing to pay.
 */
export function recentPeriods(now: Date, count = 24): string[] {
  return Array.from({ length: count }, (_, i) => periodOf(now, -i));
}

/** `2026-09` → "September 2026" in the viewer's locale; anything else as given. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return period;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
