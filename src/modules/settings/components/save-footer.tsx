"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * **The one save control for an organisation setting** (UX audit 2026-10-16, XC-11 / SET-14).
 *
 * Settings used to save five different ways — instantly, from a floating save bar, from a save bar
 * that then asked again, from a pop-up, and from a per-card button — so an admin could never tell
 * whether a change was already live. The rule now:
 *
 * - **Personal preferences** (notifications, appearance) apply the moment they are picked, with a
 *   toast saying so. They use nothing from here.
 * - **Organisation policies** save **per card**: the card holds the draft, this footer appears inside
 *   it the moment the draft differs from what is saved — "Unsaved changes", Cancel, Save — and the
 *   card registers its draft with the leave guard (`useCardGuard`), so leaving the page asks first.
 *
 * `sticky` pins the footer to the bottom of the scrolling pane while the card is on screen, for the
 * cards long enough that a footer at their foot would be out of sight of the control just changed
 * (Features, Tracking rules).
 */
export function CardSaveFooter({
  dirty,
  saving = false,
  onSave,
  onCancel,
  saveLabel = "Save changes",
  disabled = false,
  hint,
  sticky = false,
  className,
}: {
  /** The card's draft differs from what is saved. The footer renders only then. */
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  /** Puts the card back to what is saved. Nothing has been applied, so nothing needs confirming. */
  onCancel: () => void;
  saveLabel?: string;
  /** Save is unavailable — the draft is invalid (the card says why, next to the field). */
  disabled?: boolean;
  /** One short line on what Save covers, when the card alone doesn't make it obvious. */
  hint?: string;
  sticky?: boolean;
  className?: string;
}) {
  if (!dirty) return null;
  return (
    <div
      role="group"
      aria-label="Unsaved changes"
      className={cn(
        "border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4",
        // `lg:pr-16` keeps Save clear of the assistant button that floats at the bottom-right of the
        // window on desktop — a footer pinned to the bottom would otherwise sit under it.
        sticky &&
          "bg-card/95 sticky bottom-0 z-10 -mx-1 rounded-b-md px-1 pb-3 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:pr-16",
        className,
      )}
    >
      <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
        <span className="bg-warning size-2 shrink-0 rounded-full" aria-hidden />
        <span className="min-w-0">
          Unsaved changes
          {/* Dropped on phones, where it squeezed the row into a narrow column of words. */}
          {hint ? (
            <span className="text-muted-foreground hidden text-xs font-normal sm:block">{hint}</span>
          ) : null}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || disabled}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
