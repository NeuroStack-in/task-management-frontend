/**
 * Share **one in-flight request** between everyone who asks for the same read at the same time.
 *
 * Several surfaces mount together on a page load and each read the same self-scoped resource —
 * `GET /v1/me/profile` from the org-start hook, the first-run gate, the profile page and the profile
 * hydrator; `GET /v1/org` from the org hook, the org-meta store and three settings views — so one
 * navigation sent the same request four or five times (QA audit 2026-10-08, WP-369).
 *
 * Only the *in-flight* promise is shared. Once it settles the next call fetches again, so nothing is
 * ever served stale — not after an edit, and not across a sign-out and a different sign-in.
 */
export function singleFlight<T>(fetcher: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    const p = fetcher().finally(() => {
      if (pending === p) pending = null;
    });
    pending = p;
    return p;
  };
}
