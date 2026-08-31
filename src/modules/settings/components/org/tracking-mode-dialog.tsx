"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  TRACKING_MODE_META,
  isSelectableTrackingMode,
  type TrackingMode,
} from "@/lib/tracking-mode";

/**
 * The mode-change confirm dialog (MANAGED-AGENT.md §4.3). Base UI has no `RadioGroup`, so the choices
 * are hand-rolled labelled radios (the same pattern the app uses elsewhere). A transition that
 * **hides** a surface requires an explicit checkbox; a purely-additive one (nothing hidden) does not.
 * A typed-slug confirm would be disproportionate — the change is reversible and non-destructive.
 */
export function TrackingModeDialog({
  open,
  onOpenChange,
  current,
  modes,
  hiddenRoutes,
  saving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: TrackingMode;
  modes: readonly TrackingMode[];
  hiddenRoutes: Record<TrackingMode, readonly string[]>;
  saving: boolean;
  onConfirm: (next: TrackingMode) => void;
}) {
  const [choice, setChoice] = useState<TrackingMode>(current);
  const [ack, setAck] = useState(false);

  // Reset to the current mode whenever the dialog re-opens.
  useEffect(() => {
    if (open) {
      setChoice(current);
      setAck(false);
    }
  }, [open, current]);

  const changed = choice !== current;
  // A transition "hides" something if the new mode removes routes the current one showed.
  const nowHidden = new Set(hiddenRoutes[current]);
  const hides = hiddenRoutes[choice].some((r) => !nowHidden.has(r));
  const needsAck = changed && hides;
  const canConfirm = changed && (!needsAck || ack);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change how this organization tracks work</DialogTitle>
          <DialogDescription>
            Machine-based tracking is coming soon; for now, projects &amp; task
            time is the available mode. Nothing you&apos;ve already recorded is
            deleted — switching modes only shows or hides surfaces.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          {modes.map((m) => {
            const meta = TRACKING_MODE_META[m];
            const selected = choice === m;
            // Not-yet-available modes (the managed Windows service isn't deployed) are shown but
            // can't be picked. The org's *current* mode is always selectable — it's already in
            // effect, and locking someone out of switching back would be worse than the gate.
            const disabled = !isSelectableTrackingMode(m) && m !== current;
            return (
              <label
                key={m}
                className={cn(
                  "flex gap-3 rounded-lg border p-3 transition-colors",
                  disabled
                    ? "cursor-not-allowed border-border opacity-55"
                    : "cursor-pointer",
                  !disabled && selected
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <input
                  type="radio"
                  name="tracking-mode"
                  className="mt-1 accent-primary"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => !disabled && setChoice(m)}
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {meta.label}
                    {m === current && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (current)
                      </span>
                    )}
                    {disabled && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {meta.blurb}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {changed && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>
              ⚠️ Any devices already running keep tracking. Changing this hides
              or shows surfaces in the web app; it does not stop an installed
              agent — revoke devices under Settings → Device agents if that
              isn&apos;t what you want.
            </p>
            <p className="mt-2">This change is recorded in your audit log.</p>
          </div>
        )}

        {needsAck && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
            />
            I understand some surfaces will be hidden for everyone.
          </label>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            disabled={!canConfirm || saving}
            onClick={() => onConfirm(choice)}
          >
            {saving ? "Saving…" : "Change mode"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
