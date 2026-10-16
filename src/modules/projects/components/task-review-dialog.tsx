"use client";

/**
 * Review a finished task: sign it off (rate it 1–5, and it moves to Done) or send it back.
 *
 * The second half of the task lifecycle. `in_review` is the assignee saying *I finished it*; this is
 * the project's lead or manager agreeing. Signing off moves the task to `done` with the rating and
 * the reviewer's name recorded (`review_task`) — and it is the **only** way into Done (owner rule,
 * 2026-10-16): a drop on the Done column opens this dialog instead of moving the card. Sending it
 * back returns it to In progress for more work. Moving a signed-off task out of Done clears its
 * review.
 *
 * Only the project's own lead or manager reviews — not an org admin (`canReviewTask`, mirroring
 * `review_task`), and never the assignee, even a lead: reviewing your own work is the thing review
 * exists to prevent.
 */

import { useState } from "react";
import { Loader2, Star, Undo2 } from "lucide-react";
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
import { ApiError } from "@/lib/api";
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
  onSendBack,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  taskId: string;
  taskTitle: string;
  /** Refresh the board — the task leaves In review and appears under Done. */
  onReviewed: () => void;
  /** Return the task to In progress — the work isn't finished yet. */
  onSendBack: () => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

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
      toast.success("Task signed off", {
        description: `You rated it ${rating}/5. Your name is recorded as the reviewer.`,
      });
      onReviewed();
      onOpenChange(false);
      setRating(0);
      setNote("");
    } catch (e) {
      // The two refusals the server names, in words — its own text reads "Conflict: task not
      // awaiting review".
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(
        code === "task_not_awaiting_review"
          ? "This task isn't in review any more — someone may have just moved it. Check the board."
          : code === "cannot_review_own_task"
            ? "You can't sign off a task you're assigned to."
            : e instanceof ApiError && e.status === 403
              ? "Only this project's lead or manager can sign off its tasks."
              : friendlyError(e, "Couldn't submit the review."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendBack() {
    setSending(true);
    try {
      await onSendBack();
      toast.success("Sent back to In progress", {
        description: "It comes back here when it's moved to In review again.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't send the task back."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && !sending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review task</DialogTitle>
          <DialogDescription>
            <span className="text-foreground font-medium">{taskTitle}</span> is waiting for your
            review. Rate it and sign it off to move it to Done, with your name as the reviewer — or
            send it back if it needs more work.
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

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={sendBack} disabled={busy || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Send back
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy || sending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || sending || !rating}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Signing off…" : "Sign off · move to Done"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
