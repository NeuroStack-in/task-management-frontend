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
 * expired one, and a broken `<img>` is worse than the initials it replaced. The cache dies with the
 * tab, which is the correct lifetime.
 *
 * **`requested` is separate from `urls`.** A user with no photo is absent from the response, so
 * tracking only what came back would re-request them on every render forever. `requested` records
 * *asked*, `urls` records *answered*, and the difference is what makes "no avatar" a stable,
 * one-request answer rather than a loop.
 */
interface AvatarState {
  /** user id → short-lived presigned URL. Absent = no photo, or not fetched yet. */
  urls: Record<string, string>;
  /** Every id we've already asked about, whether or not it had a photo. */
  requested: Record<string, true>;
  /** Fetch any of `ids` not already asked about. Safe to call on every render. */
  ensure: (ids: string[]) => void;
}

/** Server caps a batch at 50; stay under it so nothing is silently dropped. */
const BATCH = 50;

export const useAvatarStore = create<AvatarState>()((set, get) => ({
  urls: {},
  requested: {},
  ensure: (ids) => {
    const { requested } = get();
    const missing = Array.from(
      new Set(ids.filter((id) => id && !requested[id])),
    );
    if (missing.length === 0) return;

    // Mark as requested BEFORE awaiting. Several components mount in the same tick asking about the
    // same people; without this they each see an empty cache and fire their own request.
    set((s) => ({
      requested: {
        ...s.requested,
        ...Object.fromEntries(missing.map((id) => [id, true as const])),
      },
    }));

    for (let i = 0; i < missing.length; i += BATCH) {
      const chunk = missing.slice(i, i + BATCH);
      void getEmployeeAvatarUrls(chunk).then((found) => {
        if (Object.keys(found).length === 0) return;
        set((s) => ({ urls: { ...s.urls, ...found } }));
      });
      // `getEmployeeAvatarUrls` resolves to `{}` on any failure, so a rejected promise cannot
      // escape here and the ids stay marked as requested — one attempt, then initials. Retrying a
      // decorative lookup is not worth a request budget.
    }
  },
}));
