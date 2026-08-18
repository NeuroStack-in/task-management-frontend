"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api";
import { getOrg, type OrgView } from "@/modules/settings/services/org.service";

/**
 * One shared source for the org meta (`GET /v1/org`) and its optimistic-lock `version`.
 *
 * **Why this exists.** The Organization tab renders two independent cards that both edit the same org
 * row via `PATCH /v1/org`: the profile card (name/timezone/…) and the tracking-mode card. Each used
 * to `getOrg()` on its own and keep its own `version`. Saving one bumped the server's version but not
 * the other card's copy, so the second save sent a stale version and the server answered `409` — a
 * spurious "someone else changed these settings" for a single user editing one page.
 *
 * Now both cards `load()` (deduped to a single fetch) and read `version` from here, and each calls
 * `applyPatchResult(view)` with the `OrgView` its `updateOrg(...)` returns. That threads the fresh
 * version back into the store, so whichever card saves next uses the up-to-date version — no false
 * conflict. A genuine cross-user edit still surfaces as a real `409`, exactly as before.
 */

interface OrgMetaState {
  /** The org's current meta, or `null` before it loads / when the org isn't provisioned (404). */
  view: OrgView | null;
  /** Optimistic-lock token for the next `PATCH /v1/org`. `undefined` until loaded / first save. */
  version: number | undefined;
  status: "idle" | "loading" | "ready" | "error";
  /** Load error message, shown by the profile card. A 404 is treated as "not provisioned", not error. */
  error: string | null;
  /** Fetch the org meta once. Concurrent and repeat calls share the in-flight/cached result. */
  load: () => Promise<void>;
  /** Thread a successful `PATCH /v1/org` result (esp. its new `version`) back into the shared store. */
  applyPatchResult: (view: OrgView) => void;
}

// Module-scoped so simultaneous `load()` calls from both cards collapse into one request.
let inflight: Promise<void> | null = null;

export const useOrgMetaStore = create<OrgMetaState>((set, get) => ({
  view: null,
  version: undefined,
  status: "idle",
  error: null,

  load: () => {
    if (inflight) return inflight;
    // Keep "ready" (no loader flash) on a re-fetch; only the first load shows the loader.
    set((s) => ({ status: s.view ? s.status : "loading", error: null }));
    inflight = (async () => {
      try {
        const view = await getOrg();
        set({ view, version: view.version, status: "ready", error: null });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          // Org not provisioned yet — an empty editable form, not an error.
          set({ view: null, version: undefined, status: "ready", error: null });
        } else {
          set({
            status: "error",
            error:
              e instanceof ApiError ? e.message : "Couldn't load organization settings.",
          });
        }
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  applyPatchResult: (view) => {
    set({ view, version: view.version, status: "ready", error: null });
  },
}));

/** Reset the shared org meta — call on org switch / sign-out so the next org re-fetches. */
export function resetOrgMeta(): void {
  inflight = null;
  useOrgMetaStore.setState({
    view: null,
    version: undefined,
    status: "idle",
    error: null,
  });
}
