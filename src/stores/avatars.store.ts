import { create } from "zustand";
import { getEmployeeAvatarUrls } from "@/modules/employees/services/employees.service";

/**
 * Session cache of employee avatar URLs, shared by every surface that shows a person.
 *
 * **Why a store and not a fetch per component.** Roughly thirty components render a person with an
 * initials fallback — timesheets, project members, task assignees, attendance, locations, the
 * dashboard. Giving each its own request would mean the same person's photo fetched five times on
 * one page load, against an account whose default Lambda concurrency ceiling is 10. One cache, one
 * batched request per burst of new ids, and a second page showing the same people costs nothing.
 *
 * **Deliberately NOT persisted.** These are short-lived presigned S3 URLs; a rehydrated one is an
 * expired one, and a broken `<img>` is worse than the initials it replaced. For the same reason an
 * answer is trusted only for `ANSWER_TTL_MS`, then asked for again.
 *
 * **`requested` is separate from `urls`.** A user with no photo is absent from the response, so
 * tracking only what came back would re-request them on every render forever. `requested` records
 * *asked*, `urls` records *answered*, and the difference is what makes "no avatar" a stable,
 * one-request answer rather than a loop.
 */
interface AvatarState {
  /** user id → short-lived presigned URL. Absent = no photo, or not fetched yet. */
  urls: Record<string, string>;
  /** Every id we've already asked about (→ when, epoch ms), whether or not it had a photo. */
  requested: Record<string, number>;
  /** Fetch any of `ids` not asked about recently. Safe to call on every render. */
  ensure: (ids: string[]) => void;
}

/** Server caps a batch at 50; stay under it so nothing is silently dropped. */
const BATCH = 50;

/**
 * How long an answer is trusted. The URLs are 15-minute presigns (`wp-platform/src/s3.rs`), and the
 * cache used to keep them for the life of the tab, so an avatar mounted 20 minutes in pointed at an
 * expired URL and fell back to initials until a reload (QA audit 2026-10-08, WP-231). Past this, the
 * next `ensure` asks again — with a margin, so a URL handed out is never minutes from expiry.
 */
const ANSWER_TTL_MS = 12 * 60_000;

/**
 * How long ids are collected before one request goes out. Every `<UserAvatar>` asks for exactly one
 * id from its own effect, so without a window "one batched request per burst" was in fact one
 * request per avatar — a 40-row grid fired 40 at once into a 10-concurrency account and the
 * throttled ones fell back to initials for the session (QA audit 2026-10-08, WP-065). One frame is
 * enough to catch everything a render commits.
 */
const WINDOW_MS = 16;

/** Ids asked about in the current window, not yet sent. */
let queued = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export const useAvatarStore = create<AvatarState>()((set, get) => ({
  urls: {},
  requested: {},
  ensure: (ids) => {
    const { requested } = get();
    const now = Date.now();
    const missing = Array.from(
      new Set(ids.filter((id) => id && !(now - (requested[id] ?? -Infinity) < ANSWER_TTL_MS))),
    );
    if (missing.length === 0) return;

    // Mark as requested BEFORE awaiting. Several components mount in the same tick asking about the
    // same people; without this they each see an empty cache and fire their own request. A URL
    // already held stays in `urls` until the fresh answer replaces it.
    set((s) => ({
      requested: {
        ...s.requested,
        ...Object.fromEntries(missing.map((id) => [id, now])),
      },
    }));

    for (const id of missing) queued.add(id);
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = [...queued];
      queued = new Set();
      for (let i = 0; i < batch.length; i += BATCH) {
        const chunk = batch.slice(i, i + BATCH);
        void getEmployeeAvatarUrls(chunk).then((found) => {
          if (Object.keys(found).length === 0) return;
          set((s) => ({ urls: { ...s.urls, ...found } }));
        });
        // `getEmployeeAvatarUrls` resolves to `{}` on any failure, so a rejected promise cannot
        // escape here and the ids stay marked as requested — one attempt, then initials. Retrying
        // a decorative lookup is not worth a request budget.
      }
    }, WINDOW_MS);
  },
}));
