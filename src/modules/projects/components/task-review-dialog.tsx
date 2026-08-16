"use client";

/**
 * Sign a finished task off: rate it 1–5 and close it.
 *
 * The second half of the task lifecycle. `done` is the assignee saying *I finished it*; this is
 * someone with authority over the project agreeing. On success the task moves to `closed`, which is
 * reachable **only** through this call — the board offers no drop target for it and the edit form
 * no option, because a state meaning "approved" must not be settable by the person seeking approval.
 *
 * Who sees the button is decided by the server (`ProjectRole::Manager | Lead`, which org admins and
 * owners resolve into). The caller passes `canReview`, and the assignee is excluded even when they
 * are a Lead — reviewing your own work is the thing review exists to prevent.
 */

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { reviewTask } from "../services/projects.service";

/** Mirrors the server's MIN_RATING..=MAX_RATING. It validates too; this just avoids a round trip. */
const STARS = [1, 2, 3, 4, 5] as const;

const RATING_HINT: Record<number, string> = {
  1: "Needs rework",
  2: "Below expectations",
  3: "Meets expectations",
  4: "Good work",
  5: "Excellent",
};

export function TaskReviewDialog({
  open,
  onOpenChange,
  projectId,
  taskId,
  taskTitle,
  onReviewed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  taskId: string;
  taskTitle: string;
  /** Refresh the board — the task leaves Done and appears under Closed. */
  onReviewed: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = hover || rating;

  async function submit() {
    if (!rating) {
      toast.error("Pick a rating — a review without one is just a status change.");
      return;
    }
    setBusy(true);
    try {
      await reviewTask(projectId, taskId, {
        rating,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success("Task closed", {
        description: `You rated it ${rating}/5. Your name is recorded as the reviewer.`,
      });
      onReviewed();
      onOpenChange(false);
      setRating(0);
      setNote("");
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't submit the review."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review and close</DialogTitle>
          <DialogDescription>
            <span className="text-foreground font-medium">{taskTitle}</span> — rate the finished
            work. Closing is final: the task leaves the board&apos;s active columns and your name is
            stored as the reviewer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {STARS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-pressed={rating === n}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="rounded p-0.5 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Star
                    className={cn(
                      "size-7 transition-colors",
                      n <= shown
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
              <span className="text-muted-foreground ml-2 text-sm">
                {shown ? RATING_HINT[shown] : "Not rated"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What was good, or what to do differently next time."
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !rating}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Closing…" : "Close task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
