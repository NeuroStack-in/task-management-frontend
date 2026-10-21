"use client";

/**
 * What a person can do to one task, in the two places they meet it: the "⋯" menu on a board card and
 * the footer of the task view. One component per shape so both offer the same actions under the
 * same rules — the view had none at all, and moving a card on a phone meant a long press-drag down
 * a page of stacked columns (UX audit PROJ-06, PROJ-14).
 *
 * The rules themselves live in `lib.ts` (`moveOptions`, `canDeleteTask`, `canReviewTask`); these
 * components only render the verdicts they are handed. A refused move is **shown, disabled, with
 * its reason** rather than hidden: "why can't I put this in Done?" is the question the board kept
 * answering with a toast after the fact (PROJ-07).
 */
import { ArrowRight, Lock, MoreHorizontal, Pencil, Star, Trash2, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TASK_STATUS_META, type TaskStatus } from "../types";
import { type MoveOption } from "../lib";
import { StatusMark } from "./parts";

/** The actions a caller grants — each absent when this person may not take it. */
export interface TaskActionHandlers {
  onOpen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReview?: () => void;
  /** Every other column with its verdict (`moveOptions`). Empty or absent hides "Move to". */
  moves?: MoveOption[];
  onMove?: (status: TaskStatus) => void;
}

/** One "Move to" entry per column: allowed ones act, refused ones say why. */
function MoveItems({ moves, onMove }: { moves: MoveOption[]; onMove: (s: TaskStatus) => void }) {
  return (
    <>
      <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">Move to</div>
      {moves.map((m) => {
        const meta = TASK_STATUS_META[m.status];
        const refused = m.via === "refused";
        return (
          <DropdownMenuItem
            key={m.status}
            disabled={refused}
            onClick={() => onMove(m.status)}
            // A disabled item still reads its reason — the label carries it.
            className={cn("items-start", refused && "data-disabled:opacity-100")}
          >
            {/* Blocked's stop sign, not only its colour (UX audit PROJ-21). */}
            <span className="flex h-5 shrink-0 items-center">
              <StatusMark status={m.status} className={cn(refused && "opacity-50")} />
            </span>
            <span className="flex min-w-0 flex-col leading-snug">
              <span className={cn(refused && "text-muted-foreground")}>
                {meta.label}
                {m.via === "review" ? " — review & sign off" : ""}
              </span>
              {refused && m.reason ? (
                <span className="text-muted-foreground flex items-start gap-1 text-xs">
                  <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {m.reason}
                </span>
              ) : null}
            </span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/**
 * The card's "⋯" menu. Faded in on hover like the pill it replaced, always shown on a touch screen,
 * and held visible while its menu is open.
 */
export function TaskActionsMenu({
  title,
  onOpen,
  onEdit,
  onDelete,
  onReview,
  moves,
  onMove,
  stopDrag,
}: TaskActionHandlers & {
  /** The task's title, for the trigger's accessible name. */
  title: string;
  /** Keeps a press on the trigger from starting a card drag. */
  stopDrag: Record<string, (e: React.SyntheticEvent) => void>;
}) {
  const hasMoves = Boolean(onMove && moves && moves.length > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        {...stopDrag}
        aria-label={`Actions for ${title}`}
        title="Task actions"
        className={cn(
          "bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-lg border shadow-sm transition-opacity",
          "opacity-0 group-hover/task:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100",
          // A touch screen has no hover: always shown, and a finger-sized target — 40 px, from 28
          // (UX audit PROJ-24).
          "pointer-coarse:size-10 [@media(hover:none)]:opacity-100",
        )}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {onOpen ? (
          <DropdownMenuItem onClick={onOpen}>
            <ExternalLink /> Open task
          </DropdownMenuItem>
        ) : null}
        {onEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
        ) : null}
        {onReview ? (
          <DropdownMenuItem onClick={onReview}>
            <Star /> Review &amp; sign off
          </DropdownMenuItem>
        ) : null}
        {hasMoves ? (
          <>
            <DropdownMenuSeparator />
            <MoveItems moves={moves!} onMove={onMove!} />
          </>
        ) : null}
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Delete task
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The task view's footer: the same actions as the card, as buttons. Rendered only when there is at
 * least one — a read-only viewer gets no empty bar.
 */
export function TaskActionsBar({
  onEdit,
  onDelete,
  onReview,
  moves,
  onMove,
}: TaskActionHandlers) {
  const hasMoves = Boolean(onMove && moves && moves.length > 0);
  if (!onEdit && !onDelete && !onReview && !hasMoves) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {onReview ? (
        <Button size="sm" className="gap-1.5" onClick={onReview}>
          <Star className="size-4" /> Review &amp; sign off
        </Button>
      ) : null}
      {hasMoves ? (
        <DropdownMenu>
          {/* Styled as a button rather than `render={<Button />}`: `Button` takes no ref in React 18,
              and the menu needs one to anchor to its trigger. */}
          <DropdownMenuTrigger className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
            <ArrowRight className="size-4" /> Move to…
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <MoveItems moves={moves!} onMove={onMove!} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {onEdit ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto gap-1.5"
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      ) : null}
    </div>
  );
}
