/**
 * Whether the settings pane currently on screen has unsaved edits.
 *
 * A store rather than props because the two parties sit on opposite sides of a route boundary: the
 * rail lives in `app/(app)/settings/layout.tsx`, the draft lives in whichever pane is rendered as
 * its child. There is nowhere to thread a prop between them.
 *
 * **Deliberately not persisted.** A draft is state, not a preference — reviving "you have unsaved
 * changes" after a reload, when the draft itself is long gone, would block navigation over nothing.
 */
import { create } from "zustand";

interface UnsavedState {
  /** True while the visible pane holds edits that have not been saved. */
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

export const useUnsavedStore = create<UnsavedState>((set) => ({
  dirty: false,
  setDirty: (dirty) => set({ dirty }),
}));
