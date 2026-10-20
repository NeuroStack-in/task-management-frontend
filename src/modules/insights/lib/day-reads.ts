/**
 * One read per day, shared — for the AI reports tab, where three parts of the page ask the server
 * the same question at the same moment.
 *
 * The "Needs attention" panel, the week ranking and the report library each read the org day
 * rollup and the attention list for the page's date (UX audit 2026-10-16, MON-03 / MON-05). Read
 * separately that was three identical rollup requests per day, and — worse — two simultaneous
 * attention reads on a cold cache, each of which can start its own billed model generation of the
 * same brief. Within a short window they now share one request.
 *
 * Keyed by the signed-in user as well as the day, so another sign-in in the same tab never sees
 * the previous person's organization. A failed read is dropped at once, so the next caller retries
 * rather than inheriting the failure.
 */
import {
  getAttention,
  getOrgActivity,
  type AttentionList,
  type OrgActivity,
} from "../services/insights.service";

const TTL_MS = 30_000;
const memo = new Map<string, { at: number; p: Promise<unknown> }>();

function once<T>(key: string, fresh: boolean, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (!fresh && hit && now - hit.at < TTL_MS) return hit.p as Promise<T>;
  const p = load();
  memo.set(key, { at: now, p });
  p.catch(() => {
    if (memo.get(key)?.p === p) memo.delete(key);
  });
  if (memo.size > 64) {
    for (const [k, v] of memo) if (now - v.at >= TTL_MS) memo.delete(k);
  }
  return p;
}

/** `getOrgActivity(date)`, shared for {@link TTL_MS}. `fresh` forces a new read (a Refresh). */
export function orgActivityFor(scope: string, date: string, fresh = false): Promise<OrgActivity> {
  return once(`activity|${scope}|${date}`, fresh, () => getOrgActivity(date));
}

/** `getAttention(date)`, shared for {@link TTL_MS}. `fresh` forces a new read (a Refresh). */
export function attentionFor(scope: string, date: string, fresh = false): Promise<AttentionList> {
  return once(`attention|${scope}|${date}`, fresh, () => getAttention(date));
}

/** Test seam. */
export function clearDayReads(): void {
  memo.clear();
}
