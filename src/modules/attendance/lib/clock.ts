/**
 * Time of day — **one clock, the viewer's** (UX audit 2026-10-16, TIME-14 / XC-06).
 *
 * The time and attendance pages printed clock times three ways at once: attendance forced a 24-hour
 * clock (`hour12: false`), leave and approvals forced a 12-hour one ("2:30 pm"), and corrections
 * followed the browser. One page could say "14:30" in one card and "2:30 pm" in the next. Every clock
 * time now uses the viewer's locale, with exactly the options `formatDateTime` (`@/lib/format`) uses
 * for its time half, so a moment and a bare time never disagree either.
 *
 * Client-only callers (all of these render after a data read), so the locale is the browser's.
 *
 * TODO(main agent): these belong in `src/lib/format.ts` beside `formatDateTime`; they live here only
 * because that file is not this round's to edit.
 */
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

/** Epoch ms (or a `Date`) → "14:30" / "02:30 PM", per the viewer's locale. `""` when absent. */
export function formatTimeOfDay(value: number | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, TIME_OPTS);
}

/**
 * A stored wall-clock `HH:MM` (a leave request's window, the org's "Late after") → the viewer's clock.
 * The string is a time of day with no date or zone, so it is read on an arbitrary day; anything that
 * isn't `H:MM`/`HH:MM` is returned as given rather than guessed at.
 */
export function formatWallClock(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return hhmm;
  return new Date(2000, 0, 1, h, min).toLocaleTimeString(undefined, TIME_OPTS);
}
