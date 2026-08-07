"use client";

/**
 * Declare that this pane has unsaved edits, so leaving it asks first.
 *
 * Two exits need covering and they are not the same mechanism:
 *
 * - **In-app navigation** — the settings rail sits right beside the pane being edited, so "let me
 *   just check Tracking rules before I save this" is the natural thing to do mid-edit, and it used
 *   to discard the draft with no prompt at all. The rail reads `dirty` from the store and confirms.
 * - **Closing or reloading the tab** — only `beforeunload` can intervene there, and the browser
 *   shows its own wording; nothing we pass is displayed. It is registered only while dirty, because
 *   an always-on handler disables the back/forward cache for the whole app.
 *
 * Clears on unmount, so a pane that navigates away legitimately cannot leave the guard armed and
 * block the next one.
 */
import { useEffect } from "react";

import { useUnsavedStore } from "@/stores/unsaved.store";

export function useUnsavedGuard(dirty: boolean) {
  const setDirty = useUnsavedStore((s) => s.setDirty);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

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

  useEffect(() => () => setDirty(false), [setDirty]);
}
