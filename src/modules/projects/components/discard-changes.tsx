"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/**
 * "Discard changes?" for a form in a dialog — asked only when something was actually edited.
 *
 * Escape, a click outside or the X closed the task and project forms at once and threw away
 * whatever had been typed, with no word (UX audit PROJ-19). An untouched form still closes straight
 * away: asking about nothing would only teach people to click through the question.
 *
 * The labelled **Cancel** button is not routed through this — pressing it is already the answer.
 *
 * ```tsx
 * const guard = useDiscardGuard(open, isDirty, () => onOpenChange(false));
 * <Dialog onOpenChange={(o) => (o ? onOpenChange(true) : guard.requestClose())}>
 *   <DialogContent>…<DiscardChangesDialog {...guard.prompt} /></DialogContent>
 * </Dialog>
 * ```
 *
 * Render the prompt **inside** the form's `DialogContent`, so Base UI treats it as a nested dialog:
 * Escape and an outside click then close only the question, never the form underneath.
 */
export function useDiscardGuard(open: boolean, dirty: boolean, discard: () => void) {
  const [asking, setAsking] = useState(false);
  // A form that closed (saved, or closed by its owner) has nothing left to ask about.
  useEffect(() => {
    if (!open) setAsking(false);
  }, [open]);

  return {
    /** Close if nothing was edited; otherwise ask first. */
    requestClose: () => {
      if (dirty) setAsking(true);
      else discard();
    },
    prompt: {
      open: asking,
      onOpenChange: setAsking,
      onDiscard: () => {
        setAsking(false);
        discard();
      },
    },
  };
}

/**
 * For the form's `DialogContent`: dims the form while the question is up. A nested Base UI dialog
 * draws no backdrop of its own, so the prompt sat on an undimmed form of the same width and read as
 * part of it. Base UI marks the parent popup with `data-nested-dialog-open` meanwhile.
 */
export const DIM_UNDER_PROMPT =
  "data-nested-dialog-open:after:pointer-events-none data-nested-dialog-open:after:absolute data-nested-dialog-open:after:inset-0 data-nested-dialog-open:after:rounded-[inherit] data-nested-dialog-open:after:bg-black/30";

export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Discard changes?"
      description="You've made changes in this form that haven't been saved. Closing it now loses them."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      destructive
      onConfirm={onDiscard}
    />
  );
}
