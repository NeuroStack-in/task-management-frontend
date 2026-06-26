"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsSaveBarProps {
  /** Whether there are unsaved changes. The bar renders only when true. */
  dirty: boolean;
  /** Whether a save is in progress (shows a spinner, disables actions). */
  saving?: boolean;
  onSave: () => void;
  onReset: () => void;
  saveLabel?: string;
}

/**
 * Sticky "unsaved changes" bar for settings panes. Appears only when there are
 * pending edits, with Reset + Save and a saving state. Centered as a floating
 * pill so it never collides with the corner action button.
 */
export function SettingsSaveBar({
  dirty,
  saving = false,
  onSave,
  onReset,
  saveLabel = "Save changes",
}: SettingsSaveBarProps) {
  if (!dirty) return null;

  return (
    <div className="pointer-events-none sticky bottom-6 z-20 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur duration-300 animate-in fade-in slide-in-from-bottom-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 shrink-0 rounded-full bg-warning" />
          <span className="hidden sm:inline">You have unsaved changes</span>
          <span className="sm:hidden">Unsaved changes</span>
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
            Reset
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="gap-1.5"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
