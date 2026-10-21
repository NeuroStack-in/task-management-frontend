/**
 * A count with its noun agreeing — "1 row", "2 rows", "1,204 captures" (UX audit 2026-10-16,
 * MON-23). Analytics printed "1 rows" and "0 of 1 employees" wherever a count met a fixed plural.
 *
 * `many` defaults to `one` + "s"; pass it for the irregular ones ("person" / "people").
 */
export function countOf(n: number, one: string, many: string = `${one}s`): string {
  return `${n.toLocaleString()} ${nounFor(n, one, many)}`;
}

/** Just the noun for `n` — for markup that styles the number apart from the word. */
export function nounFor(n: number, one: string, many: string = `${one}s`): string {
  return n === 1 ? one : many;
}
