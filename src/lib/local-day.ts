/**
 * Local-day arithmetic for surfaces that read **UTC-partitioned** records.
 *
 * The screenshot endpoint (`GET /v1/insights/screenshots?date=`) partitions on
 * `utc_date(captured_at)` — ingest writes `GSI4PK` from it. Anything that then buckets those frames
 * by the viewer's local hour is mixing two different 24-hour windows: at UTC+5:30 one UTC partition
 * is local 05:30 → 05:30 the *next* morning.
 *
 * That has produced two separate bugs. The hourly activity chart drew the following morning's
 * captures on its left edge, so a day looked like someone had been at their desk at 4am. The
 * dashboard heatmap did worse quietly: its columns start at 8am, so the wrapped frames fell outside
 * every column and were **silently discarded**, and its weekday came from the UTC date while its
 * hours came from the local clock — two axes, two calendars.
 *
 * So the rule these helpers encode: **assemble a local day from the UTC partitions that overlap it,
 * then filter back to that local date.** One place to get it right, since getting it wrong is
 * invisible — the chart still renders, just about a slightly different day than its title claims.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` for an epoch-ms instant, in the **viewer's** timezone. */
export function localDateOf(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The UTC-keyed partitions that can hold records belonging to local day `date`.
 *
 * One when the viewer is on UTC, two otherwise — local midnight and local 23:59:59 fall in
 * different UTC days at every other offset.
 */
export function utcDatesFor(date: string): string[] {
  // No `Z` ⇒ parsed as local time, which is the point.
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [date];
  const end = new Date(start.getTime() + 86_400_000 - 1);
  const first = start.toISOString().slice(0, 10);
  const last = end.toISOString().slice(0, 10);
  return first === last ? [first] : [first, last];
}
