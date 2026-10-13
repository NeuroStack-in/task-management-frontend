/**
 * Whether the settings pane currently on screen has unsaved edits.
 *
 * A store rather than props because the two parties sit on opposite sides of a route boundary: the
 * rail lives in `app/(app)/settings/layout.tsx`, the draft lives in whichever pane is rendered as
 * its child. There is nowhere to thread a prop between them.
 *
 * **One entry per guard, not one shared boolean.** A page can hold several drafts at once (the
 * Organization page has a profile form, schedule cards, a weights form and an office perimeter), and
 * a single flag that each caller overwrote let the last writer win: opening a clean editor cleared
 * the profile form's `true`, and leaving then discarded that draft without a prompt
 * (QA audit 2026-10-08, WP-347). `dirty` is true while *any* guard reports edits.
 *
 * **Deliberately not persisted.** A draft is state, not a preference — reviving "you have unsaved
 * changes" after a reload, when the draft itself is long gone, would block navigation over nothing.
 */
import { create } from "zustand";

interface UnsavedState {
  /** True while any guard on screen holds edits that have not been saved. */
  dirty: boolean;
  /** The guards (one per `useUnsavedGuard` caller) currently holding unsaved edits. */
  owners: string[];
  /** Report one guard's state; `owner` is that caller's own stable id. */
  setDirty: (owner: string, dirty: boolean) => void;
  /** Forget every draft — the user chose to discard them and leave. */
  clear: () => void;
  /** Where the user asked to go while edits were unsaved — the settings layout confirms it. */
  pendingHref: string | null;
  /**
   * Ask to leave for `href`. `true` means go ahead (nothing is unsaved); `false` means a
   * "discard unsaved changes?" confirmation now holds the request, and navigates if confirmed.
   */
  requestLeave: (href: string) => boolean;
  /** Drop the pending request — the user chose to stay. */
  cancelLeave: () => void;
}

export const useUnsavedStore = create<UnsavedState>((set, get) => ({
  dirty: false,
  owners: [],
  setDirty: (owner, dirty) =>
    set((s) => {
      if (s.owners.includes(owner) === dirty) return s;
      const owners = dirty ? [...s.owners, owner] : s.owners.filter((o) => o !== owner);
      // A pending "discard?" only means something while there is a draft to discard — otherwise a
      // request left over (the page was left some other way) would pop up on the next visit.
      return owners.length > 0
        ? { owners, dirty: true }
        : { owners, dirty: false, pendingHref: null };
    }),
  clear: () => set({ owners: [], dirty: false, pendingHref: null }),
  pendingHref: null,
  requestLeave: (href) => {
    if (!get().dirty) return true;
    // Another spot on this same page (a #section, a query) discards nothing.
    if (
      typeof window !== "undefined" &&
      new URL(href, window.location.href).pathname === window.location.pathname
    ) {
      return true;
    }
    set({ pendingHref: href });
    return false;
  },
  cancelLeave: () => set({ pendingHref: null }),
}));
