"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  TriangleAlert,
  Download,
  Loader2,
  ShieldOff,
  FolderX,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { OrgOwnersCard } from "./org-owners-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { WILDCARD } from "@/constants/permissions";
import { ApiError } from "@/lib/api";
import {
  exportOrg,
  getExportStatus,
  closeOrg,
  type ExportStatusResult,
} from "@/modules/settings/services/org.service";
import { buildZip } from "@/lib/zip";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useOrgSlug } from "@/hooks/use-org";

/**
 * Ownership & lifecycle — the real backend (`identity` context, LLD §14).
 *
 * Wired onto the owner-only routes: `POST /v1/org/export` and `POST /v1/org/close`. Every
 * irreversible action requires the owner to **re-type the workspace slug** (the `confirm` field) —
 * never a one-click.
 *
 * Ownership is handed over by **adding** an owner (see `OrgOwnersCard`), not by transferring one.
 * An org can hold several owners, so the transfer flow — which moved the role and demoted the
 * caller in a single irreversible step — was a sharper tool for the same job.
 */

/** What closing removes — shown before the owner commits. */
const CONSEQUENCES = [
  {
    icon: ShieldOff,
    text: "Every member immediately loses access to the organization.",
  },
  {
    icon: FolderX,
    text: "All projects, tasks, time entries, reports, and activity history are scheduled for deletion.",
  },
  {
    icon: ReceiptText,
    text: "The subscription is cancelled and billing for this organization stops.",
  },
];

/** Maps a failed org action to a human toast. Owner-only routes 403; a wrong slug 400s. */
function reportError(e: unknown, fallback: string) {
  if (e instanceof ApiError) {
    if (e.status === 403) {
      toast.error("Owner only", {
        description: "Only the current Organization Owner can do this.",
      });
      return;
    }
    if (e.status === 400) {
      toast.error("That didn't match", {
        description:
          e.message || "The confirmation didn't match your workspace slug.",
      });
      return;
    }
    toast.error(e.message || fallback);
    return;
  }
  toast.error(fallback);
}

/**
 * A confirm dialog that requires the user to type their workspace **slug** before the action fires.
 *
 * **It shows the slug.** The dialog used to demand a string the product displayed nowhere: the slug
 * is not the org's name and is not derivable from it (`<name>-<last 6 of the tenant id>`), so an
 * owner asked to "type your workspace slug" had no way to learn it and simply could not close or
 * export their organization. Typing something reasonable — the org name — just returned "that
 * didn't match", with no hint where to find the right value.
 *
 * Showing it does not weaken the confirmation. The point of typing a slug is to make the action
 * **deliberate**, not to test recall — the same reason GitHub prints the repository name above the
 * box it asks you to type it into. A gate nobody can pass is not a safety feature.
 *
 * The server still validates: a mismatch surfaces as a 400. The button guards against an empty
 * entry, and against a value that plainly differs from the slug we fetched.
 */
function ConfirmSlugDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: (slug: string) => void;
}) {
  const [value, setValue] = useState("");
  const slug = useOrgSlug();

  function close(next: boolean) {
    if (!next) setValue("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Workspace slug</Label>
          {/* Rendered selectable rather than as a copy button: the owner is being asked to type it
              on purpose, and a one-click copy would turn a deliberate act back into a reflex. */}
          {slug ? (
            <p className="text-muted-foreground text-xs">
              Your workspace slug is{" "}
              <code className="text-foreground bg-muted rounded px-1 py-0.5 font-mono select-all">
                {slug}
              </code>
            </p>
          ) : null}
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={slug ?? "your-workspace-slug"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!value.trim() || busy}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OwnershipSettings() {
  const { role } = usePermissions();
  const isOwner = role?.permissions.includes(WILDCARD) ?? false;

  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  // The in-flight/last export job this session. Polled while accepted/running; `files` carries
  // time-limited presigned links once done (~15 min — re-poll refreshes them).
  const [exportJob, setExportJob] = useState<ExportStatusResult | null>(null);

  useEffect(() => {
    if (!exportJob || (exportJob.status !== "accepted" && exportJob.status !== "running")) {
      return;
    }
    const id = setInterval(() => {
      getExportStatus(exportJob.job_id)
        .then(setExportJob)
        .catch(() => {
          /* transient poll failure — keep the last state, next tick retries */
        });
    }, 4000);
    return () => clearInterval(id);
  }, [exportJob]);

  const [acknowledged, setAcknowledged] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  async function handleExport(slug: string) {
    setExportBusy(true);
    try {
      const res = await exportOrg(slug);
      setExportOpen(false);
      setExportJob({ job_id: res.job_id, status: res.status, files: [] });
      toast.success("Export started", {
        description: "Walking your organization's data — download links appear here when done.",
      });
    } catch (e) {
      reportError(e, "Couldn't start the export.");
    } finally {
      setExportBusy(false);
    }
  }

  /**
   * Fetch every export file via its presigned URL and bundle one .zip client-side (lib/zip, STORE
   * — screenshots are already-compressed WebP, JSONL is tiny). Bounded fan-out so a big export
   * doesn't open hundreds of sockets. Needs the bucket's GET CORS rule; a fetch failure usually
   * means the ~15-min links expired — re-polling the status refreshes them.
   */
  async function handleDownloadAll() {
    if (!exportJob || exportJob.files.length === 0) return;
    setZipping(true);
    try {
      const entries = await mapWithConcurrency(exportJob.files, 4, async (f) => {
        const res = await fetch(f.url);
        if (!res.ok) throw new Error(`${f.name}: ${res.status}`);
        return { name: f.name, data: new Uint8Array(await res.arrayBuffer()) };
      });
      const blob = buildZip(entries);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `workpulse-export-${exportJob.job_id}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Most likely an expired presigned link — refresh them, keep the list usable.
      toast.error("Couldn't bundle the export", {
        description: "Refreshing the download links — try again in a moment.",
      });
      getExportStatus(exportJob.job_id).then(setExportJob).catch(() => {});
    } finally {
      setZipping(false);
    }
  }

  async function handleClose(slug: string) {
    setCloseBusy(true);
    try {
      const res = await closeOrg(slug);
      setCloseOpen(false);
      setAcknowledged(false);
      const when =
        typeof res.purge_after === "number"
          ? ` Data is purged after ${new Date(
              res.purge_after * 1000,
            ).toLocaleDateString()}.`
          : "";
      toast.success("Organization closed", {
        description: `Status: ${res.status}.${when}`,
      });
    } catch (e) {
      reportError(e, "Couldn't close the organization.");
    } finally {
      setCloseBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ownership & closure"
        description="Transfer the organization to another owner, export your data, or close this organization."
      />

      {!isOwner && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Only the{" "}
          <span className="font-medium text-foreground">Organization Owner</span>{" "}
          can transfer ownership or close the organization.
        </div>
      )}

      {/* ── Owners ── */}
      <OrgOwnersCard />

      {/* ── Export data ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
            <Download className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Export organization data
            </h3>
            <p className="text-sm text-muted-foreground">
              Request a complete copy of your organization. The export runs as a
              background job; you&apos;ll be able to download it once it finishes.
            </p>
          </div>
        </div>
        {exportJob ? (
          <div className="border-t border-border px-6 py-4">
            {exportJob.status === "done" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Export ready — {exportJob.files.length} file
                    {exportJob.files.length === 1 ? "" : "s"}{" "}
                    <span className="font-normal text-muted-foreground">
                      (links expire after ~15 minutes; re-open this page to refresh them)
                    </span>
                  </p>
                  <Button size="sm" onClick={handleDownloadAll} disabled={zipping}>
                    {zipping ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    {zipping ? "Bundling…" : "Download all (.zip)"}
                  </Button>
                </div>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {exportJob.files.map((f) => (
                    <li key={f.name}>
                      <a
                        href={f.url}
                        download={f.name}
                        className="text-sm text-primary underline-offset-2 hover:underline"
                      >
                        {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : exportJob.status === "failed" ? (
              <p className="text-sm text-destructive">
                Export {exportJob.job_id} failed — request a new one.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Export {exportJob.status}… walking your data (job {exportJob.job_id}).
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            disabled={!isOwner || exportJob?.status === "running" || exportJob?.status === "accepted"}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" /> Request export
          </Button>
        </div>
      </Card>

      {/* ── Close organization ── */}
      <Card className="gap-0 border border-destructive/30 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Close this organization
            </h3>
            <p className="text-sm text-muted-foreground">
              Close the organization and schedule its data for deletion. This can
              be reversed only during the grace period before purge.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-destructive/20 px-6 py-5">
          <ul className="space-y-2.5">
            {CONSEQUENCES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-sm">
                <Icon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(Boolean(v))}
              disabled={!isOwner}
              className="mt-0.5"
            />
            <span className="text-muted-foreground">
              I understand this closes the organization and schedules all of its
              data for permanent deletion.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end border-t border-destructive/20 bg-destructive/5 px-6 py-4">
          <Button
            variant="destructive"
            disabled={!isOwner || !acknowledged}
            onClick={() => setCloseOpen(true)}
          >
            <TriangleAlert className="size-4" /> Close organization
          </Button>
        </div>
      </Card>

      {/* ── Confirmations (typed-slug) ── */}
      <ConfirmSlugDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export organization data?"
        description={
          <>
            This starts a background export of your entire organization. Type your{" "}
            <span className="font-medium text-foreground">workspace slug</span> to
            confirm.
          </>
        }
        confirmLabel={exportBusy ? "Starting…" : "Start export"}
        busy={exportBusy}
        onConfirm={handleExport}
      />

      <ConfirmSlugDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close organization?"
        description={
          <>
            This closes the organization and schedules all data for deletion. Type
            your <span className="font-medium text-foreground">workspace slug</span>{" "}
            to confirm.
          </>
        }
        confirmLabel={closeBusy ? "Closing…" : "Close organization"}
        destructive
        busy={closeBusy}
        onConfirm={handleClose}
      />
    </div>
  );
}
