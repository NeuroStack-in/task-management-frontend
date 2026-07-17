/**
 * Bounded parallel map — run `fn` over `items` at most `limit` at a time, preserving order.
 *
 * Why this exists: an unbounded `Promise.all(list.map(apiCall))` over a live list tripped Lambda
 * throttling (37 projects → 74 simultaneous calls → 503s that blanked the page). Any per-item API
 * fan-out must go through here with a small cap (~3). `apiFetch` already retries transient GET 503/429;
 * this keeps the burst from happening in the first place.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
