/** Currency formatting helpers. */

/**
 * `amount` in `currency` (ISO 4217), at most two decimals, in the viewer's locale.
 *
 * Payroll passes the **org's** currency. It used to print a literal `$` with en-US grouping and
 * whatever fraction digits `toLocaleString` chose, so an INR org saw "$425,000" and hourly totals
 * read "$1,000.139" (QA audit 2026-10-08, WP-078). Omitted, it is USD — WorkPulse's own prices on
 * the Billing page are in dollars. An unknown code degrades to the number and the code, never a throw.
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  // A missing amount is "—", never "US$NaN". The server removes fields a caller isn't cleared to see,
  // and an employee's own payslip once arrived without its amounts (UX audit 2026-10-16, TIME-01).
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  }
}
