"use client";

/**
 * Declare that this pane (or card) has unsaved edits, so leaving it asks first.
 *
 * Two exits need covering and they are not the same mechanism:
 *
 * - **In-app navigation** — the settings rail sits right beside the pane being edited, so "let me
 *   just check Tracking rules before I save this" is the natural thing to do mid-edit, and it used
 *   to discard the draft with no prompt at all. The settings layout reads `dirty` from the store and
 *   confirms any in-app link (rail, sidebar, navbar); programmatic navigations such as search ask
 *   through `requestLeave`.
 * - **Closing or reloading the tab** — only `beforeunload` can intervene there, and the browser
 *   shows its own wording; nothing we pass is displayed. It is registered only while dirty, because
 *   an always-on handler disables the back/forward cache for the whole app.
 *
 * Each caller reports under its own id, so several drafts on one page compose instead of
 * overwriting each other. Clears on unmount, so a pane that navigates away legitimately cannot leave
 * the guard armed and block the next one. (The browser's Back button is not intercepted: the App
 * Router offers no way to hold a history navigation.)
 */
import { useEffect, useId } from "react";

import { useUnsavedStore } from "@/stores/unsaved.store";

export function useUnsavedGuard(
  dirty: boolean,
  {
    keptOnLeave = false,
  }: {
    /**
     * The draft lives in a shared store that outlives this pane (the office perimeter), so leaving
     * within the app loses nothing and must not claim it does — only closing or reloading the tab
     * is guarded.
     */
    keptOnLeave?: boolean;
  } = {},
) {
  const owner = useId();
  const setDirty = useUnsavedStore((s) => s.setDirty);

  useEffect(() => {
    setDirty(owner, dirty && !keptOnLeave);
  }, [owner, dirty, keptOnLeave, setDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require a returnValue to trigger the prompt; the string is never shown.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => () => setDirty(owner, false), [owner, setDirty]);
}
