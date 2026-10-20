/**
 * A leave figure in days, to at most two decimals.
 *
 * A permission spends `hours / 8` of a day, so balances go fractional: after a 45-minute permission
 * the raw figure is 19.90625, which the balance cards printed as "19.90625 / 20 days" and "0.09375
 * taken" (QA audit 2026-10-08, WP-479). Whole numbers stay whole ("20", not "20.00").
 */
export function formatDays(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

/** "1 day", "2.5 days", "0.25 of a day" — a leave cost said the way a person would say it. */
export function daysPhrase(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n > 0 && n < 1) return `${formatDays(n)} of a day`;
  return `${formatDays(n)} day${n === 1 ? "" : "s"}`;
}

/**
 * Minutes as a short amount of time: `120` → "2 h", `90` → "1 h 30 min", `45` → "45 min".
 *
 * Short time off within a day is stored as minutes (the API's `permission` kind). It used to print
 * as a stopwatch reading — "02:00:00" — under the HR word "Permission", which nobody asking for two
 * hours off at the dentist would recognise as their own request (UX audit 2026-10-16, TIME-08).
 */
export function formatHoursShort(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** "2 h off" — how a few hours' leave is listed wherever a request appears (TIME-08). */
export function formatHoursOff(minutes: number): string {
  return `${formatHoursShort(minutes)} off`;
}

/** The kind's plain name, for the request dialog's choice and anything that names the kind. */
export const HOURS_OFF_KIND_LABEL = "A few hours";
