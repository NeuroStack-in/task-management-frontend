"use client";

import { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, Eye, Loader2, Paperclip, Star } from "lucide-react";
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
  const assignee = task.assigneeId ? userMap[task.assigneeId] : null;

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
                      onView={viewKindOf(a) ? () => openViewer(a) : undefined}
                    />
                  ))}
                </ul>
              )}
            </section>
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
