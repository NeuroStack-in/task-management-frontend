"use client";

/**
 * A list of attached documents, each viewable **in the app** and downloadable to the device.
 *
 * Extracted from the task-attachment viewer in `view-task-dialog` so leave requests get the same
 * behaviour rather than a second, subtly different one. The only thing that differs between
 * surfaces is *how you get a URL for an attachment* — a task needs a project and task id, a leave
 * document needs a user and request id — so that is the one thing the caller supplies, as
 * `resolveUrl`. Everything else (what can be previewed, how bytes are fetched, how a download is
 * triggered) is identical and lives here once.
 *
 * ## Why the URL is resolved per action, never up front
 *
 * These URLs are short-lived presigned S3 links, and a presigned GET is a **bearer credential** for
 * that object. Resolving them at render would put a working link in the DOM for every row on screen
 * and leave it there, stale, until the page changed. So a URL is minted when someone actually
 * clicks, used once, and discarded.
 */
import { useState } from "react";
import { Download, Eye, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/shared/markdown";

/** The metadata shape every attachment surface already returns. */
export interface DocumentItem {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

/** What the in-app viewer can render. `null` ⇒ download only (Word, and anything unrecognised). */
type ViewKind = "image" | "pdf" | "markdown" | "text";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/**
 * Decide by content type **and** extension. A browser that guessed the type wrong, or a server that
 * stored `application/octet-stream`, would otherwise make a perfectly previewable PDF download-only.
 */
export function viewKindOf(doc: DocumentItem): ViewKind | null {
  const ct = doc.content_type ?? "";
  const ext = extOf(doc.filename);
  if (ct.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return "image";
  }
  if (ct === "application/pdf" || ext === ".pdf") return "pdf";
  if (ct === "text/markdown" || ext === ".md") return "markdown";
  if (ct === "text/plain" || ext === ".txt") return "text";
  return null;
}

function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Save the object to the device without navigating: fetch the bytes (the bucket allows CORS GET),
 * wrap in a blob and click a synthetic `<a download>`.
 *
 * A plain `window.open` on a presigned URL *displays* the file in a new tab instead of saving it,
 * which is the behaviour this deliberately replaces.
 */
async function saveToDevice(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blobUrl = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a delay: revoking immediately races the browser's own read of the blob.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

interface ViewerState {
  doc: DocumentItem;
  kind: ViewKind;
  loading: boolean;
  /** image / pdf — an object URL over the fetched blob. */
  blobUrl?: string;
  /** text / markdown — the fetched contents. */
  text?: string;
  error?: boolean;
}

export function DocumentList({
  documents,
  resolveUrl,
  className,
}: {
  documents: DocumentItem[];
  /** Mint a short-lived URL for one attachment id. Called per click, never at render. */
  resolveUrl: (attachmentId: string) => Promise<string>;
  className?: string;
}) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const closeViewer = () =>
    setViewer((v) => {
      // Without this every preview leaks its blob for the lifetime of the page.
      if (v?.blobUrl) URL.revokeObjectURL(v.blobUrl);
      return null;
    });

  const openViewer = async (doc: DocumentItem) => {
    const kind = viewKindOf(doc);
    if (!kind) return;
    setViewer({ doc, kind, loading: true });
    try {
      const url = await resolveUrl(doc.id);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`view failed (${res.status})`);
      if (kind === "text" || kind === "markdown") {
        setViewer({ doc, kind, loading: false, text: await res.text() });
      } else {
        setViewer({ doc, kind, loading: false, blobUrl: URL.createObjectURL(await res.blob()) });
      }
    } catch {
      setViewer({ doc, kind, loading: false, error: true });
    }
  };

  if (documents.length === 0) return null;

  return (
    <>
      <ul className={className ?? "space-y-1"}>
        {documents.map((d) => (
          <DocumentRow
            key={d.id}
            doc={d}
            resolveUrl={resolveUrl}
            onView={viewKindOf(d) ? () => openViewer(d) : undefined}
          />
        ))}
      </ul>

      <Dialog open={!!viewer} onOpenChange={(o) => !o && closeViewer()}>
        <DialogContent className="flex max-h-[92vh] w-[92vw] flex-col p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-4 py-3 pr-10">
            <DialogTitle className="truncate text-sm leading-snug">
              {viewer?.doc.filename}
            </DialogTitle>
            <DialogDescription className="sr-only">Document preview</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
            {viewer?.loading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewer?.error ? (
              <div className="flex min-h-[40vh] items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t load the preview. You can still download the file.
                </p>
              </div>
            ) : viewer?.kind === "image" && viewer.blobUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewer.blobUrl}
                alt={viewer.doc.filename}
                className="mx-auto max-h-[78vh] rounded object-contain"
              />
            ) : viewer?.kind === "pdf" && viewer.blobUrl ? (
              <iframe
                src={viewer.blobUrl}
                title={viewer.doc.filename}
                className="h-[78vh] w-full rounded border bg-white"
              />
            ) : viewer?.kind === "markdown" && viewer.text !== undefined ? (
              <div className="max-h-[78vh] overflow-auto rounded border bg-card p-5 sm:p-6">
                <Markdown>{viewer.text}</Markdown>
              </div>
            ) : viewer?.kind === "text" && viewer.text !== undefined ? (
              <pre className="max-h-[78vh] overflow-auto whitespace-pre-wrap rounded border bg-card p-3 font-mono text-xs">
                {viewer.text}
              </pre>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentRow({
  doc,
  resolveUrl,
  onView,
}: {
  doc: DocumentItem;
  resolveUrl: (attachmentId: string) => Promise<string>;
  /** Present only when the type can be previewed in-app. Word files are download-only. */
  onView?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await saveToDevice(await resolveUrl(doc.id), doc.filename);
    } catch {
      toast.error(`Couldn't download “${doc.filename}”. Try again.`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm">
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {humanSize(doc.size)}
      </span>
      {onView ? (
        <button
          type="button"
          onClick={onView}
          aria-label={`View ${doc.filename}`}
          title="View"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Eye className="size-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        aria-label={`Download ${doc.filename}`}
        title="Download"
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
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
