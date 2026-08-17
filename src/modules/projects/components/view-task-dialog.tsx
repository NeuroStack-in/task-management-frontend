"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Paperclip, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  type Attachment,
  type Task,
} from "../types";
import { toneSoft, type UserMini } from "../lib";
import { StatusBadge } from "./parts";
import { getAttachmentDownloadUrl } from "../services/projects.service";

/** Human file size, e.g. "812 B", "2.3 MB". */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface ViewTaskDialogProps {
  /** The task to show. `null` renders nothing (the dialog stays closed). */
  task: Task | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userMap: Record<string, UserMini>;
}

export function ViewTaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
  userMap,
}: ViewTaskDialogProps) {
  if (!task) return null;

  const status = TASK_STATUS_META[task.status];
  const prio = TASK_PRIORITY_META[task.priority];
  const assignee = task.assigneeId ? userMap[task.assigneeId] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base leading-snug">{task.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge tone={status.tone} label={status.label} />
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                toneSoft[prio.tone],
              )}
            >
              {prio.label} priority
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          {/* Meta */}
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Assignee
              </dt>
              <dd>
                {assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar className="size-6">
                      {assignee.avatarUrl ? (
                        <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                      ) : null}
                      <AvatarFallback className="text-[0.6rem]">
                        {initials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Due date
              </dt>
              <dd className="tabular-nums">
                {task.dueDate ? (
                  formatFullDate(task.dueDate)
                ) : (
                  <span className="text-muted-foreground">No due date</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Estimate
              </dt>
              <dd className="tabular-nums">{task.estimateHours} hrs</dd>
            </div>
          </dl>

          {/* Description */}
          <section className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Description
            </p>
            {task.description.trim() ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No description</p>
            )}
          </section>

          {/* Review sign-off */}
          {task.review ? (
            <section className="bg-muted/40 space-y-1 rounded-xl border p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Star className="fill-warning text-warning size-4" />
                <span className="tabular-nums">{task.review.rating}/5</span>
                <span className="text-muted-foreground font-normal">
                  · reviewed by {task.review.reviewer_name || "a project lead"}
                </span>
              </p>
              {task.review.note ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {task.review.note}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Attachments */}
          <section className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Attachments · {task.attachments.length}
            </p>
            {task.attachments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No attachments</p>
            ) : (
              <ul className="space-y-1.5">
                {task.attachments.map((a) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    projectId={projectId}
                    taskId={task.id}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentRow({
  attachment,
  projectId,
  taskId,
}: {
  attachment: Attachment;
  projectId: string;
  taskId: string;
}) {
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const url = await getAttachmentDownloadUrl(projectId, taskId, attachment.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(`Couldn’t open “${attachment.filename}”. Try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <li className="bg-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
      <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {humanSize(attachment.size)}
      </span>
      <button
        type="button"
        onClick={download}
        disabled={loading}
        aria-label={`Download ${attachment.filename}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
      </button>
    </li>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** e.g. "Aug 17, 2026" — UTC to match the rest of the projects surface. */
function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
