import type { ApiTypeBalance } from "../services/leave.service";

/**
 * What a cell says, in words and figures (UX audit 2026-10-16, TIME-17):
 *  - an allowance of `0` is **no limit** — the server never refuses a request against it
 *    (`balance_allows`), so "0 / 0" read as "none left" for a type that can't run out;
 *  - no balance row yet is **not started**, at the catalog allowance — the server seeds exactly that
 *    figure, with nothing used, the next time the person touches Leave (`seed_user_year`). It read
 *    "Not granted", which sounded like the person had been refused an allowance.
 */
export function balanceCell(
  b: Pick<ApiTypeBalance, "seeded" | "allowance" | "used" | "remaining">,
  typeAllowance: number,
): { noLimit: boolean; notStarted: boolean; remaining: number; allowance: number; used: number } {
  const notStarted = !b.seeded;
  const allowance = notStarted ? typeAllowance : b.allowance;
  const used = notStarted ? 0 : b.used;
  return {
    noLimit: allowance <= 0,
    notStarted,
    allowance,
    used,
    remaining: notStarted ? typeAllowance : b.remaining,
  };
}
