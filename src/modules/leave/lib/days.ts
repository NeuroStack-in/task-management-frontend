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
