/**
 * Why "Request leave" is disabled, in words, or `null` when there is nothing to explain (UX audit
 * 2026-10-16, TIME-23 — the button was greyed out with no reason when no leave type was requestable).
 *
 *  - Nothing while the page is loading (the catalog simply hasn't arrived) or showing its own load
 *    error, and nothing when at least one type can be requested.
 *  - A failed catalog read is "couldn't load", never "none set up": the page must not tell anyone
 *    their organization has no leave types on the strength of a request that failed.
 *  - Someone who can edit the catalog is not told to ask an admin — the page offers them the way to
 *    it instead (`canManageTypes`), so the sentence stops before the advice.
 */
export function requestUnavailableReason({
  loading,
  failed,
  requestableTypes,
  typesFailed,
  canManageTypes,
}: {
  loading: boolean;
  /** The page's own read (balances/requests) failed — it already shows an error banner. */
  failed: boolean;
  requestableTypes: number;
  /** The leave-type catalog read failed. */
  typesFailed: boolean;
  canManageTypes: boolean;
}): string | null {
  if (loading || failed || requestableTypes > 0) return null;
  if (typesFailed) {
    return "Leave types couldn't be loaded, so leave can't be requested right now. Use Refresh to try again.";
  }
  return canManageTypes ? "No leave types are set up yet." : "No leave types are set up yet. Ask your admin.";
}
