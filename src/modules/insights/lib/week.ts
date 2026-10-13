/**
 * Weeks that follow the org's schedule rather than assuming Monday.
 *
 * The Activity tab and the report library both built "the week" from Monday, so a Sun–Thu org's
 * week was Mon–Thu plus the *following* Sunday, and a six-day org never saw its Saturday in a weekly
 * report (QA audit 2026-10-08, WP-283 / WP-487). Pure and local-date based, like `lib/workdays.ts`.
 */
import { isoWeekday, isWorkday, type IsoWeekday } from "@/lib/workdays";

const pad = (n: number) => String(n).padStart(2, "0");

/** A local `Date` → `YYYY-MM-DD`. */
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

/**
 * The ISO weekday the org's week **starts** on: the first scheduled day after its longest run of
 * days off. Mon–Fri starts on Monday, Sun–Thu on Sunday, a six- or seven-day week on Monday.
 */
export function weekStartOf(workdays: readonly IsoWeekday[]): IsoWeekday {
  const on = new Set<number>(workdays);
  if (on.size === 0 || on.size === 7) return 1;
  const next = (d: number) => (d === 7 ? 1 : d + 1);
  let best = -1;
  let start: IsoWeekday = 1;
  for (let d = 1; d <= 7; d++) {
    const prev = d === 1 ? 7 : d - 1;
    // A run of days off begins here: this day is off, the one before was on.
    if (on.has(d) || !on.has(prev)) continue;
    let len = 0;
    let cur = d;
    while (!on.has(cur) && len < 7) {
      len += 1;
      cur = next(cur);
    }
    if (len > best) {
      best = len;
      start = cur as IsoWeekday;
    }
  }
  return start;
}

/** The first day (`YYYY-MM-DD`) of the org's week containing `iso`, given its start weekday. */
export function weekStartIso(iso: string, start: IsoWeekday): string {
  return shiftIso(iso, -((isoWeekday(parseIso(iso)) - start + 7) % 7));
}

/** The org's **scheduled** dates in its week containing `anchor`, in order. */
export function weekWorkdays(anchor: string, workdays: readonly IsoWeekday[]): string[] {
  const first = weekStartIso(anchor, weekStartOf(workdays));
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const iso = shiftIso(first, i);
    if (isWorkday(parseIso(iso), workdays)) out.push(iso);
  }
  return out;
}

/**
 * The most recent scheduled day **strictly before** `today` (`YYYY-MM-DD`) — the last day that has
 * had a chance to close. Looks back at most a week; with no scheduled day at all, yesterday.
 */
export function lastWorkdayBefore(today: string, workdays: readonly IsoWeekday[]): string {
  for (let back = 1; back <= 7; back++) {
    const iso = shiftIso(today, -back);
    if (isWorkday(parseIso(iso), workdays)) return iso;
  }
  return shiftIso(today, -1);
}
