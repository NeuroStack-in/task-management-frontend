"use client";

/**
 * Review a finished task: sign it off (rate it 1–5, and it moves to Done) or request changes.
 *
 * The second half of the task lifecycle. `in_review` is the assignee saying *I finished it*; this is
 * the project's lead or manager agreeing. Signing off moves the task to `done` with the rating and
 * the reviewer's name recorded (`review_task`) — and it is the **only** way into Done (owner rule,
 * 2026-10-16): a drop on the Done column opens this dialog instead of moving the card. **Requesting
 * changes** returns it to In progress with a note the assignees are notified of and see on the card
 * (UX audit PROJ-02) — it used to be a bare move with no word to anyone, which left a 1-star "Needs
 * rework" sign-off, closing the task, as the only verdict that carried a message. Moving a
 * signed-off task out of Done clears its review.
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

// 1 is "Poor", not "Needs rework": signing off always closes the task. Work that needs more doing
// goes back with "Request changes" instead.
const RATING_HINT: Record<number, string> = {
  1: "Poor",
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
  /** Refresh the board — the task left In review (to Done, or back to In progress). */
  onReviewed: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  /** "Request changes" mode: the note becomes the required message to the assignees. */
  const [changesMode, setChangesMode] = useState(false);
  const [changesNote, setChangesNote] = useState("");

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
    const message = changesNote.trim();
    if (!message) {
      toast.error("Say what needs changing — the assignees get this note.");
      return;
    }
    setSending(true);
    try {
      await reviewTask(projectId, taskId, { outcome: "changes", note: message });
      toast.success("Changes requested", {
        description:
          "It's back in In progress with your note, and the assignees have been notified. It returns here when it's moved to In review again.",
      });
      onReviewed();
      onOpenChange(false);
      setChangesMode(false);
      setChangesNote("");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(
        code === "task_not_awaiting_review"
          ? "This task isn't in review any more — someone may have just moved it. Check the board."
          : code === "cannot_review_own_task"
            ? "You can't review a task you're assigned to."
            : e instanceof ApiError && e.status === 403
              ? "Only this project's lead or manager can review its tasks."
              : friendlyError(e, "Couldn't send the task back."),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && !sending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{changesMode ? "Request changes" : "Review task"}</DialogTitle>
          <DialogDescription>
            {changesMode ? (
              <>
                <span className="text-foreground font-medium">{taskTitle}</span> goes back to In
                progress. Say what needs changing — the assignees are notified and see your note on
                the task.
              </>
            ) : (
              <>
                <span className="text-foreground font-medium">{taskTitle}</span> is waiting for your
                review. Rate it and sign it off to move it to Done, with your name as the reviewer —
                or request changes if it needs more work.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {changesMode ? (
          <div className="space-y-1.5">
            <Label htmlFor="changes-note">What needs changing</Label>
            <textarea
              id="changes-note"
              value={changesNote}
              onChange={(e) => setChangesNote(e.target.value)}
              rows={4}
              maxLength={1000}
              autoFocus
              placeholder="e.g. The export misses the totals row — add it and re-check the March figures."
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
        ) : (
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
        )}

        {changesMode ? (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangesMode(false)} disabled={sending}>
              Back
            </Button>
            <Button onClick={sendBack} disabled={sending || !changesNote.trim()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
              {sending ? "Sending…" : "Send back with note"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setChangesMode(true)}
              disabled={busy || sending}
            >
              <Undo2 className="size-4" />
              Request changes
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
        )}
      </DialogContent>
    </Dialog>
  );
}
