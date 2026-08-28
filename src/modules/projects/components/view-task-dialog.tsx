"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, Circle, Download, Eye, Loader2, Paperclip, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { personName } from "@/lib/format";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  type Attachment,
  type Subtask,
  type SubtaskProgress,
  type Task,
  type TaskStatus,
} from "../types";
import { toneSoft, type UserMini } from "../lib";
import { AssignedByLine } from "./assignees";
import { StatusBadge } from "./parts";
import { getAttachmentDownloadUrl, listSubtasks } from "../services/projects.service";
import { ApiError } from "@/lib/api";
import { UserAvatar } from "@/components/shared/user-avatar";

/** Human file size, e.g. "812 B", "2.3 MB". */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** What the in-app viewer can render. `null` = download only (e.g. .docx). */
type ViewKind = "image" | "pdf" | "markdown" | "text";
function viewKindOf(a: Attachment): ViewKind | null {
  const ct = a.contentType;
  const ext = extOf(a.filename);
  if (ct.startsWith("image/") || [".png", ".jpg", ".jpeg"].includes(ext)) return "image";
  if (ct === "application/pdf" || ext === ".pdf") return "pdf";
  // Markdown renders formatted (GitHub-style); plain text stays monospace as-is.
  if (ct === "text/markdown" || ext === ".md") return "markdown";
  if (ct === "text/plain" || ext === ".txt") return "text";
  return null; // .docx and anything else — no in-app preview
}

/**
 * Save the presigned object to the device without navigating: fetch the bytes (the bucket allows
 * CORS GET), wrap in a blob, and click a synthetic `<a download>`. A plain `window.open` opened the
 * file in a new tab instead of downloading it, which is what this replaces.
 */
async function saveToDevice(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

interface ViewerState {
  attachment: Attachment;
  kind: ViewKind;
  loading: boolean;
  /** For image/pdf: an object URL of the fetched blob. */
  blobUrl?: string;
  /** For text/markdown: the fetched contents. */
  text?: string;
  error?: boolean;
}

interface ViewTaskDialogProps {
  /** The task to show. `null` renders nothing (the dialog stays closed). */
  task: Task | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userMap: Record<string, UserMini>;
}

/**
 * One labelled block. Every section of this dialog is the same shape — a small caps label over its
 * content — and hand-spacing each one is how the padding drifted and the whole thing read as a form
 * dump. The dividers come from the parent's `divide-y`, so sections need no margins of their own.
 */
function Section({
  label,
  count,
  className,
  children,
}: {
  label: string;
  /** Rendered as a separate pill so the number stays legible instead of hiding inside the label. */
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-2 px-1 py-4 first:pt-2 last:pb-1", className)}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
        {label}
        {count !== undefined ? (
          <span className="bg-muted rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-semibold tabular-nums">
            {count}
          </span>
        ) : null}
      </p>
      {children}
    </section>
  );
}

/** A field with nothing in it. One component so "no description" and "no due date" match. */
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}


/**
 * A task's breakdown, read-only.
 *
 * **Deliberately has no "add subtask" control.** Subtasks are created and ticked off in the desktop
 * app, where the timer that runs against them lives; the web is a reader. A button here would put
 * the two clients in disagreement about who owns the breakdown.
 *
 * Fetched when the dialog opens rather than with the board, because the board already carries the
 * only thing every card needs — the counter. Pulling every task's full breakdown into the board read
 * would load a hundred lists to render one.
 */
function SubtasksSection({
  projectId,
  taskId,
  progress,
  open,
  userMap,
}: {
  projectId: string;
  taskId: string;
  progress: SubtaskProgress;
  open: boolean;
  userMap: Record<string, UserMini>;
}) {
  const [rows, setRows] = useState<Subtask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to fetch when the counter already says there is no breakdown — the common case, and
    // skipping it keeps opening a plain task at one request instead of two.
    if (!open || progress.total === 0) {
      setRows(null);
      setError(null);
      return;
    }
    let alive = true;
    setError(null);
    listSubtasks(projectId, taskId)
      .then((r) => {
        if (!alive) return;
        setRows(
          r.subtasks.map((x) => ({
            id: x.id,
            taskId: x.task_id,
            title: x.title,
            status: x.status as TaskStatus,
            assigneeId: x.assignee_id ?? null,
            createdBy: x.created_by,
            createdAt: x.created_at,
            completedAt: x.completed_at ?? null,
          })),
        );
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // Say the breakdown could not be loaded rather than rendering an empty list — an empty list
        // here would read as "this task has no subtasks", which is a different and wrong answer.
        setError(e instanceof ApiError ? e.message : "Could not load subtasks");
      });
    return () => {
      alive = false;
    };
  }, [open, projectId, taskId, progress.total]);

  if (progress.total === 0) return null;

  return (
    <Section label="Subtasks" count={progress.total}>
      <p className="text-muted-foreground mb-2 text-xs tabular-nums">
        {progress.done} of {progress.total} done
      </p>
      {error ? (
        <Empty>{error}</Empty>
      ) : rows === null ? (
        <Empty>Loading…</Empty>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((s) => {
            const done = s.status === "done" || s.status === "closed";
            const who = s.assigneeId ? userMap[s.assigneeId]?.name : null;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                {done ? (
                  <CheckCircle2 className="text-success size-4 shrink-0" />
                ) : (
                  <Circle className="text-muted-foreground size-4 shrink-0" />
                )}
                <span className={cn("min-w-0 flex-1 truncate", done && "text-muted-foreground line-through")}>
                  {s.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {TASK_STATUS_META[s.status]?.label ?? s.status}
                  {who ? ` · ${who}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function ViewTaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
  userMap,
}: ViewTaskDialogProps) {
  // Hook before the early return — rules of hooks. The viewer is a nested dialog over this one.
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  if (!task) return null;

  const status = TASK_STATUS_META[task.status];
  const prio = TASK_PRIORITY_META[task.priority];

  const closeViewer = () => {
    setViewer((v) => {
      if (v?.blobUrl) URL.revokeObjectURL(v.blobUrl);
      return null;
    });
  };

  const openViewer = async (a: Attachment) => {
    const kind = viewKindOf(a);
    if (!kind) return;
    setViewer({ attachment: a, kind, loading: true });
    try {
      const url = await getAttachmentDownloadUrl(projectId, task.id, a.id);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`view failed (${res.status})`);
      if (kind === "text" || kind === "markdown") {
        setViewer({ attachment: a, kind, loading: false, text: await res.text() });
      } else {
        const blobUrl = URL.createObjectURL(await res.blob());
        setViewer({ attachment: a, kind, loading: false, blobUrl });
      }
    } catch {
      setViewer({ attachment: a, kind, loading: false, error: true });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-[0.95rem] leading-snug font-semibold">
              {task.title}
            </DialogTitle>
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

          <div className="min-h-0 flex-1 divide-y overflow-y-auto">
            <Section label={task.assignees.length > 1 ? "Assignees" : "Assignee"}>
              {task.assignees.length === 0 ? (
                <Empty>Unassigned — anyone on this project can pick it up</Empty>
              ) : (
                <ul className="space-y-2.5">
                  {task.assignees.map((a) => {
                    const u = userMap[a.userId];
                    const name = personName(u?.name);
                    return (
                      // The "assigned by" line sits **under** the name, not opposite it. Pushed to
                      // the far edge it opened a gap the width of the dialog and read as an
                      // unrelated column; stacked, it is plainly a footnote about this person.
                      <li key={a.userId} className="flex items-center gap-2.5">
                        <UserAvatar
                          userId={a.userId}
                          name={name}
                          className="size-8 shrink-0"
                          fallbackClassName="text-xs"
                        />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate text-sm font-medium">{name}</span>
                          <AssignedByLine assignee={a} userMap={userMap} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* Two facts of the same kind, so they share one row and one baseline rather than
                being two more stacked label/value sections. */}
            <div className="grid grid-cols-2 divide-x">
              <Section label="Due date">
                {task.dueDate ? (
                  <p className="text-sm tabular-nums">{formatFullDate(task.dueDate)}</p>
                ) : (
                  <Empty>No due date</Empty>
                )}
              </Section>
              <Section label="Estimate" className="pl-4">
                <p className="text-sm tabular-nums">{task.estimateHours} hrs</p>
              </Section>
            </div>

            <Section label="Description">
              {task.description.trim() ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </p>
              ) : (
                <Empty>No description</Empty>
              )}
            </Section>

            <SubtasksSection
              projectId={projectId}
              taskId={task.id}
              progress={task.subtaskProgress}
              open={open}
              userMap={userMap}
            />

            {/* Review sign-off */}
            {task.review ? (
              <Section label="Review">
                <div className="bg-muted/40 space-y-1 rounded-xl border p-3">
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
                </div>
              </Section>
            ) : null}

            <Section
              label="Attachments"
              // The count belongs beside the label, not inside it: "ATTACHMENTS · 0" reads as a
              // heading that happens to contain a number, and disappears at a glance.
              count={task.attachments.length}
            >
              {task.attachments.length === 0 ? (
                <Empty>No attachments</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {task.attachments.map((a) => (
                    <AttachmentRow
                      key={a.id}
                      attachment={a}
                      projectId={projectId}
                      taskId={task.id}
                      onView={viewKindOf(a) ? () => openViewer(a) : undefined}
                    />
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app viewer — a nested dialog over the task view. */}
      <Dialog open={!!viewer} onOpenChange={(o) => !o && closeViewer()}>
        <DialogContent className="flex max-h-[92vh] w-[92vw] flex-col p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-4 py-3 pr-10">
            <DialogTitle className="truncate text-sm leading-snug">
              {viewer?.attachment.filename}
            </DialogTitle>
            <DialogDescription className="sr-only">Attachment preview</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
            {viewer?.loading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : viewer?.error ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
                <p className="text-muted-foreground text-sm">Couldn’t load the preview.</p>
              </div>
            ) : viewer?.kind === "image" && viewer.blobUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.blobUrl}
                alt={viewer.attachment.filename}
                className="mx-auto max-h-[78vh] rounded object-contain"
              />
            ) : viewer?.kind === "pdf" && viewer.blobUrl ? (
              <iframe
                src={viewer.blobUrl}
                title={viewer.attachment.filename}
                className="h-[78vh] w-full rounded border bg-white"
              />
            ) : viewer?.kind === "markdown" && viewer.text !== undefined ? (
              <div className="bg-card max-h-[78vh] overflow-auto rounded border p-5 sm:p-6">
                <MarkdownDoc>{viewer.text}</MarkdownDoc>
              </div>
            ) : viewer?.kind === "text" && viewer.text !== undefined ? (
              <pre className="bg-card max-h-[78vh] overflow-auto rounded border p-3 font-mono text-xs whitespace-pre-wrap">
                {viewer.text}
              </pre>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachmentRow({
  attachment,
  projectId,
  taskId,
  onView,
}: {
  attachment: Attachment;
  projectId: string;
  taskId: string;
  /** Present only when the type can be previewed in-app (image / pdf / txt / md). */
  onView?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const url = await getAttachmentDownloadUrl(projectId, taskId, attachment.id);
      await saveToDevice(url, attachment.filename);
    } catch {
      toast.error(`Couldn’t download “${attachment.filename}”. Try again.`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="bg-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
      <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {humanSize(attachment.size)}
      </span>
      {onView ? (
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${attachment.filename}`}
          title="View"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
        >
          <Eye className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        aria-label={`Download ${attachment.filename}`}
        title="Download"
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
      >
        {downloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
      </button>
    </li>
  );
}

/**
 * Document-scale Markdown for the attachment preview — GitHub-README styling (real heading sizes,
 * ruled top-level headings, GFM tables + fenced code). Deliberately distinct from
 * `@/components/shared/markdown`, which is compressed for chat bubbles. No raw HTML (react-markdown's
 * default) — this renders an uploaded file, so injected markup stays inert text.
 */
function MarkdownDoc({ children }: { children: string }) {
  return (
    <div className="text-foreground text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 border-b pb-1.5 text-2xl font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 border-b pb-1.5 text-xl font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-lg font-semibold first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-2 text-base font-semibold first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="mt-4 mb-1 text-sm font-semibold first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-muted-foreground mt-4 mb-1 text-sm font-semibold first:mt-0">
              {children}
            </h6>
          ),
          p: ({ children }) => <p className="my-3 first:mt-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="marker:text-muted-foreground my-3 ml-6 list-disc space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="marker:text-muted-foreground my-3 ml-6 list-decimal space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="text-muted-foreground my-3 border-l-4 pl-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5" />,
          code: ({ className: cls, children }) => {
            const fenced = /language-/.test(cls ?? "");
            return fenced ? (
              <code className="bg-muted block overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
                {children}
              </code>
            ) : (
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-3">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b px-3 py-1.5 font-medium whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => <td className="border-b px-3 py-1.5 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
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
