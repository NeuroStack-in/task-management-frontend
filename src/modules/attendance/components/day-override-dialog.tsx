"use client";

/**
 * Correct one person's closed day — the admin day-override
 * (`PUT /v1/attendance/user/{id}/day/{date}/override`, MANAGED-AGENT.md §4.4a).
 *
 * In a managed-agent org nobody files leave (employees have no login), so without this every
 * holiday and sick day stays "Absent" in the record and in every report built on it. The endpoint
 * was deployed with no screen calling it (QA audit 2026-10-08, WP-380). It can only *excuse* a day —
 * presence must be earned by real sessions — and the server records who set it in the audit log.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { overrideDay, type OverrideStatus } from "../services/attendance.service";

const OPTIONS: { value: OverrideStatus; label: string; hint: string }[] = [
  { value: "leave", label: "On leave", hint: "Planned time off" },
  { value: "excused", label: "Excused", hint: "Unplanned, but authorised" },
  { value: "non_workday", label: "Non-working day", hint: "A one-off closure" },
];

export interface DayOverrideTarget {
  userId: string;
  name: string;
}

export function DayOverrideDialog({
  target,
  date,
  dateLabel,
  onClose,
  onSaved,
}: {
  /** Whose day is being corrected; `null` keeps the dialog closed. */
  target: DayOverrideTarget | null;
  /** `YYYY-MM-DD` — the closed day. */
  date: string;
  /** The same day, as the page shows it. */
  dateLabel: string;
  onClose: () => void;
  onSaved: (userId: string, status: OverrideStatus) => void;
}) {
  const [status, setStatus] = useState<OverrideStatus>("leave");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Fresh for every person the dialog is opened on.
  useEffect(() => {
    setStatus("leave");
    setNote("");
  }, [target]);

  if (!target) return null;

  const save = async () => {
    setSaving(true);
    try {
      await overrideDay(target.userId, date, status, note.trim() || undefined);
      const label = OPTIONS.find((o) => o.value === status)?.label ?? status;
      toast.success(`${target.name} · ${dateLabel} is now ${label}`, {
        description: "Recorded in the audit log under your name.",
      });
      onSaved(target.userId, status);
    } catch (e) {
      // Corrections work in every tracking mode since 2026-10-17 (TIME-04), so the old 409 for
      // project-mode orgs no longer exists; anything the server refuses explains itself.
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't save the correction. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Correct {target.name} · {dateLabel}
          </DialogTitle>
          <DialogDescription>
            Record an authorised absence for this day. It replaces the computed status, can&apos;t
            mark anyone present, and is attributed to you in the audit log. There is no undo: a
            corrected day can be changed to another of these, but not back to its computed status.
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Record the day as" className="grid gap-2">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={status === o.value}
              onClick={() => setStatus(o.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                status === o.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60",
              )}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="day-override-note">
            Note <span className="text-muted-foreground">optional</span>
          </Label>
          <Input
            id="day-override-note"
            placeholder="e.g. Sick — called in at 9:00"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
