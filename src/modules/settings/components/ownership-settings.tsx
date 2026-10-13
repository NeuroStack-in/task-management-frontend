"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Download,
  FolderX,
  Loader2,
  Lock,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  TriangleAlert,
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
  getExportStatusAll,
  listExports,
  closeOrg,
  reopenOrg,
  type ExportStatusResult,
} from "@/modules/settings/services/org.service";
import { buildZip, ZIP_MAX_ENTRIES, ZipTooLargeError } from "@/lib/zip";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useOrgSlug } from "@/hooks/use-org";
import { useAuthStore } from "@/stores/auth.store";
import { useOrgMetaStore } from "@/stores/org-meta.store";

/**
 * Ownership & lifecycle — the real backend (`identity` context, LLD §14).
 *
 * Wired onto the owner-only routes: `POST /v1/org/export` (+ `GET /v1/org/exports/{id}`),
 * `POST /v1/org/close` and `POST /v1/org/reopen`. Export and close ask the owner to **re-type the
 * workspace slug** first — never a one-click.
 *
 * Ownership is handed over by **adding** an owner (see `OrgOwnersCard`), not by transferring one.
 * An org can hold several owners, so the transfer flow — which moved the role and demoted the
 * caller in a single irreversible step — was a sharper tool for the same job.
 */

/**
 * What closing does — shown before the owner commits.
 *
 * These have to be exact. This list is the last thing read before an irreversible action, so a
 * sentence that overstates what happens is worse here than anywhere else in the product.
 *
 * It used to open with "Every member immediately loses access to the organization", which was wrong
 * twice over: the **owner keeps theirs** (deliberately — `on_org_closing` skips owners so someone
 * can still reopen or let the purge run), and "immediately" overstates it for everyone else.
 * Closing disables each non-owner's Cognito login, which stops the next sign-in; it does not revoke
 * a token already issued, and there is no request-time check for a closing org. With a 15-minute ID
 * token, a member already signed in keeps working for up to that long.
 */
const CONSEQUENCES = [
  {
    icon: ShieldOff,
    text: "Employees and admins can no longer sign in, and anyone still signed in is locked out within 15 minutes. You keep your own access.",
  },
  {
    icon: FolderX,
    text: "All projects, tasks, time entries, reports, and activity history are scheduled for deletion.",
  },
  {
    icon: RotateCcw,
    text: "You have 30 days to reopen the organization. After that the data is purged permanently.",
  },
  {
    icon: ReceiptText,
    text: "The subscription is cancelled and billing for this organization stops.",
  },
];

/** How often a running export is checked. */
const EXPORT_POLL_MS = 4_000;
/** Consecutive failed checks before the page stops and says so (about 20 s at the cadence above). */
const MAX_POLL_FAILURES = 5;
/**
 * After this long without progress a still-"running" export may be stuck, so the owner is told and
 * may request another. The server now marks a job `failed` when a step keeps failing (WP-350); this
 * covers the case it can't see — a chain that silently stopped.
 */
const STALE_EXPORT_MS = 2 * 60 * 60 * 1000;
/** The most file data "Download all" will hold in the tab: every byte sits in memory, twice. */
const MAX_BUNDLE_BYTES = 1024 ** 3;
/** Export files are deleted after 7 days (the `exports/` lifecycle rule in `infra/stacks/storage_stack.py`). */
const EXPORT_KEPT_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The export being followed, remembered per browser so leaving the page (or opening a file in this
 * tab) doesn't lose it — the server has no "list my exports" route, so a job id that only lived in
 * component state was gone for good on any navigation (QA audit 2026-10-08, WP-349). A `wp-` key, so
 * sign-out clears it; keyed by tenant so it never follows another org.
 */
const EXPORT_KEY = "wp-org-export";

function rememberedExport(tenant: string | null): string | null {
  if (!tenant) return null;
  try {
    const raw = window.localStorage.getItem(EXPORT_KEY);
    const v = raw ? (JSON.parse(raw) as { tenant?: string; jobId?: string }) : null;
    return v && v.tenant === tenant && v.jobId ? v.jobId : null;
  } catch {
    return null;
  }
}

function rememberExport(tenant: string | null, jobId: string | null): void {
  try {
    if (tenant && jobId) {
      window.localStorage.setItem(EXPORT_KEY, JSON.stringify({ tenant, jobId }));
    } else {
      window.localStorage.removeItem(EXPORT_KEY);
    }
  } catch {
    // Storage unavailable — the export is still followed for as long as the page stays open.
  }
}

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
        description: e.message || "The confirmation didn't match your workspace slug.",
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
 * The button stays off until the typed value **is** the slug (once the slug has loaded; before that,
 * until something is typed). For export that check is the whole confirmation — the server's export
 * route reads no body — so it used to start a full export for any text at all, and the typed value
 * survived a success, making the next one a single click (QA audit 2026-10-08, WP-530). Close is
 * also checked server-side: a mismatch there surfaces as a 400.
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
  const inputId = useId();
  const typed = value.trim();
  const matches = slug ? typed === slug : typed.length > 0;

  // Start empty every time, however the dialog was closed — the parent closes it directly on success.
  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  function close(next: boolean) {
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
          <Label htmlFor={inputId}>Workspace slug</Label>
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
            id={inputId}
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
            disabled={!matches || busy}
            onClick={() => onConfirm(typed)}
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

  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [zipping, setZipping] = useState(false);
  // The export being followed (remembered across visits — see `EXPORT_KEY`). Polled while
  // accepted/running; `files` carries time-limited presigned links once done (~15 min — another
  // status read refreshes them).
  const [exportJob, setExportJob] = useState<ExportStatusResult | null>(null);
  /**
   * Why the page stopped following the export, if it did. Every poll error used to be swallowed and
   * the poll never ended — and the server never marked a job failed (it does now) — so any persistent fault left
   * "Export running…" spinning with Request disabled for good (QA audit 2026-10-08, WP-350).
   */
  const [exportTrouble, setExportTrouble] = useState<
    "unreachable" | "gone" | "forbidden" | null
  >(null);
  /** When the last status landed — the clock the "running for a long time" hint reads. */
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const pollFailures = useRef(0);
  /** The job being followed — a late answer about any other job is ignored. */
  const followed = useRef<string | null>(null);

  /** Stop following the export: its files are gone, or it never existed. */
  const forgetExport = useCallback(() => {
    followed.current = null;
    rememberExport(tenant, null);
    setExportJob(null);
    setExportTrouble("gone");
  }, [tenant]);

  /** One status read: refreshes the state (and, once done, the download links). */
  const checkExport = useCallback(
    async (jobId: string) => {
      try {
        // Every page of a finished export's files — the server pages the list (WP-350).
        const s = await getExportStatusAll(jobId);
        if (followed.current !== jobId) return;
        const now = Date.now();
        if (s.status === "done" && typeof s.completed_at === "number") {
          if (now - s.completed_at > EXPORT_KEPT_MS) {
            forgetExport();
            return;
          }
        }
        pollFailures.current = 0;
        setExportJob(s);
        setExportTrouble(null);
        setCheckedAt(now);
      } catch (e) {
        if (followed.current !== jobId) return;
        if (e instanceof ApiError && e.status === 404) {
          // Expired or never existed — nothing more will come of it.
          forgetExport();
        } else if (e instanceof ApiError && e.status === 403) {
          setExportTrouble("forbidden");
        } else if (++pollFailures.current >= MAX_POLL_FAILURES) {
          setExportTrouble("unreachable");
        }
      }
    },
    [forgetExport],
  );

  // Pick up the export this browser was following — or, when it remembers none, the org's newest
  // export that is still running or downloadable (another browser's, or one started before this
  // browser's storage was cleared — WP-349). Owner-only on the server; a 403/404 just means none.
  useEffect(() => {
    let live = true;
    const follow = (jobId: string) => {
      followed.current = jobId;
      setExportJob({ job_id: jobId, status: "accepted", files: [] });
      void checkExport(jobId);
    };
    const jobId = rememberedExport(tenant);
    if (jobId) {
      follow(jobId);
      return;
    }
    if (!isOwner) return;
    listExports()
      .then((jobs) => {
        if (!live || followed.current) return;
        const now = Date.now();
        const pick = jobs.find(
          (j) =>
            j.status === "accepted" ||
            j.status === "running" ||
            (j.status === "done" &&
              typeof j.completed_at === "number" &&
              now - j.completed_at < EXPORT_KEPT_MS),
        );
        if (pick) {
          rememberExport(tenant, pick.job_id);
          follow(pick.job_id);
        }
      })
      .catch(() => {
        /* No list (older server, or not an owner): nothing to pick up. */
      });
    return () => {
      live = false;
    };
  }, [tenant, checkExport, isOwner]);

  const exportActive =
    !!exportJob && (exportJob.status === "accepted" || exportJob.status === "running");

  useEffect(() => {
    if (!exportJob || !exportActive || exportTrouble) return;
    const jobId = exportJob.job_id;
    const id = setInterval(() => void checkExport(jobId), EXPORT_POLL_MS);
    return () => clearInterval(id);
  }, [exportJob, exportActive, exportTrouble, checkExport]);

  /** Running for longer than an export should take — it may be stuck, so another may be requested. */
  // Measured from the job's last progress when the server reports it, else from the request.
  const lastMoved = exportJob?.updated_at ?? exportJob?.requested_at;
  const exportStale =
    exportActive &&
    typeof lastMoved === "number" &&
    checkedAt !== null &&
    checkedAt - lastMoved > STALE_EXPORT_MS;

  const [acknowledged, setAcknowledged] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);

  // The org's lifecycle state, from the shared org meta (one fetch, shared with the Organization
  // tab). A `closing` org swaps the Close card for the Reopen one. Before this, nothing in the
  // product read the status: after a close the page looked unchanged, `reopenOrg` had no caller, and
  // the 30-day window the card promised could only be used by hand-calling the API — while the
  // day-30 purge was real (QA audit 2026-10-08, WP-007).
  const { view: org, load: loadOrg } = useOrgMetaStore();
  useEffect(() => {
    void loadOrg();
  }, [loadOrg]);
  const closing = org?.status === "closing";
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);

  async function handleExport(slug: string) {
    setExportBusy(true);
    try {
      const res = await exportOrg(slug);
      setExportOpen(false);
      followed.current = res.job_id;
      rememberExport(tenant, res.job_id);
      pollFailures.current = 0;
      setExportTrouble(null);
      setCheckedAt(Date.now());
      setExportJob({
        job_id: res.job_id,
        status: res.status,
        files: [],
        requested_at: Date.now(),
      });
      toast.success("Export started", {
        description:
          "Walking your organization's data — download links appear here when done.",
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
   * doesn't open hundreds of sockets. Needs the bucket's GET CORS rule.
   *
   * **Bounded in size, too.** Every byte is held in the tab until the archive is built, and the
   * format stops at 65,534 files / 4 GB — an export with every screenshot can pass both, which used
   * to crash the tab or write a silently corrupt archive, and either failure was reported as
   * "expired links" (QA audit 2026-10-08, WP-351). Past the limits the files are listed for
   * individual download instead.
   */
  async function handleDownloadAll() {
    if (!exportJob || exportJob.files.length === 0) return;
    const tooBig = () =>
      toast.error("This export is too large to bundle in the browser", {
        description: "Download the files one by one from the list instead.",
      });
    if (exportJob.files.length > ZIP_MAX_ENTRIES) {
      tooBig();
      return;
    }
    setZipping(true);
    const abort = new AbortController();
    let total = 0;
    let overLimit = false;
    try {
      const entries = await mapWithConcurrency(exportJob.files, 4, async (f) => {
        if (abort.signal.aborted) throw new Error("bundle aborted");
        const res = await fetch(f.url, { signal: abort.signal });
        if (!res.ok) throw new Error(`${f.name}: ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        total += data.length;
        if (total > MAX_BUNDLE_BYTES) {
          overLimit = true;
          abort.abort();
          throw new Error("bundle too large");
        }
        return { name: f.name, data };
      });
      const blob = buildZip(entries);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `workpulse-export-${exportJob.job_id}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      if (overLimit || e instanceof ZipTooLargeError) {
        tooBig();
      } else {
        // A file couldn't be fetched — most likely its ~15-minute link expired. Refresh them all.
        toast.error("Couldn't download every file", {
          description:
            "The download links may have expired — refreshing them; try again in a moment.",
        });
        void checkExport(exportJob.job_id);
      }
    } finally {
      abort.abort();
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
      // Pick up `closing` + the purge date, so this page turns into the Reopen card at once.
      void loadOrg();
    } catch (e) {
      reportError(e, "Couldn't close the organization.");
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleReopen() {
    setReopenBusy(true);
    try {
      await reopenOrg();
      setReopenOpen(false);
      await loadOrg();
      toast.success("Organization reopened", {
        // The server re-enables members' logins asynchronously (`OrgReopened`), so say "being".
        description:
          "The scheduled deletion is cancelled. Sign-in is being restored for employees and admins — it can take a minute.",
      });
    } catch (e) {
      reportError(e, "Couldn't reopen the organization.");
    } finally {
      setReopenBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ownership & closure"
        description="Manage the organization's owners, export your data, or close this organization."
      />

      {/* There is no transfer flow — ownership is handed over by adding an owner (WP-536). */}
      {!isOwner && (
        <div className="border-border bg-muted text-muted-foreground flex items-center gap-2.5 rounded-md border px-5 py-3 text-sm">
          <Lock className="size-4 shrink-0" />
          Only an <span className="text-foreground font-medium">
            Organization Owner
          </span>{" "}
          can manage owners, export data, or close the organization.
        </div>
      )}

      {/* ── Owners ── */}
      <OrgOwnersCard />

      {/* ── Export data ── */}
      <Card className="gap-0 p-0">
        <div className="flex items-start gap-4 px-6 py-5">
          <span className="bg-feature-tint text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <Download className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base font-medium">
              Export organization data
            </h3>
            <p className="text-muted-foreground text-sm">
              Request a complete copy of your organization. The export runs as a
              background job; you&apos;ll be able to download it once it finishes.
            </p>
          </div>
        </div>
        {exportTrouble === "gone" ? (
          <div className="border-border border-t px-6 py-4">
            <p className="text-muted-foreground text-sm">
              That export is no longer available — request a new one.
            </p>
          </div>
        ) : null}
        {exportJob ? (
          <div className="border-border border-t px-6 py-4">
            {exportTrouble === "forbidden" ? (
              <p className="text-muted-foreground text-sm">
                Only an Organization Owner can follow this export.
              </p>
            ) : exportTrouble === "unreachable" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-destructive text-sm">
                  We couldn&apos;t check on this export (job {exportJob.job_id}).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    pollFailures.current = 0;
                    setExportTrouble(null);
                    void checkExport(exportJob.job_id);
                  }}
                >
                  <RefreshCw className="size-3.5" /> Check again
                </Button>
              </div>
            ) : exportJob.status === "done" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Export ready — {exportJob.files.length} file
                    {exportJob.files.length === 1 ? "" : "s"}{" "}
                    <span className="text-muted-foreground font-normal">
                      (kept for 7 days; each link works for about 15 minutes — refresh
                      them here)
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Another status read presigns fresh links. "Re-open this page to refresh
                        them" used to lose the export instead (WP-349). */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void checkExport(exportJob.job_id)}
                      disabled={zipping}
                    >
                      <RefreshCw className="size-3.5" /> Refresh links
                    </Button>
                    <Button size="sm" onClick={handleDownloadAll} disabled={zipping}>
                      {zipping ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      {zipping ? "Bundling…" : "Download all (.zip)"}
                    </Button>
                  </div>
                </div>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {exportJob.files.map((f) => (
                    <li key={f.name}>
                      {/* A new tab: the links are cross-origin, so `download` is ignored and a file
                          like manifest.json opened in this tab, leaving the page. */}
                      <a
                        href={f.url}
                        download={f.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm underline-offset-2 hover:underline"
                      >
                        {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : exportJob.status === "failed" ? (
              <p className="text-destructive text-sm">
                {exportJob.error ??
                  `Export ${exportJob.job_id} failed — request a new one.`}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Export {exportJob.status}… walking your data (job {exportJob.job_id}).
                  You can leave this page — it picks the export up again when you come
                  back.
                </p>
                {typeof exportJob.files_total === "number" &&
                exportJob.files_total > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {exportJob.files_total.toLocaleString()} file
                    {exportJob.files_total === 1 ? "" : "s"} written so far
                    {exportJob.phase === "users"
                      ? " — now copying each person's records"
                      : ""}
                    .
                  </p>
                ) : null}
                {exportStale ? (
                  <p className="text-muted-foreground text-xs">
                    It has been running for over two hours. Large organizations take
                    longer, but if it seems stuck you can request a new export.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            variant="outline"
            // Held while an export is running and being followed — not forever: once the page has
            // lost track of it, or it has run far longer than an export should, another may start.
            disabled={!isOwner || (exportActive && !exportTrouble && !exportStale)}
            onClick={() => setExportOpen(true)}
          >
            <Download className="size-4" /> Request export
          </Button>
        </div>
      </Card>

      {/* ── Closing: the Reopen card ── */}
      {closing ? (
        <Card className="border-destructive/30 gap-0 border p-0">
          <div className="flex items-start gap-4 px-6 py-5">
            <span className="bg-destructive/10 text-destructive mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
              <TriangleAlert className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-base font-medium">
                This organization is closing
              </h3>
              <p className="text-muted-foreground text-sm">
                Employees and admins can&apos;t sign in.{" "}
                {typeof org?.purge_after === "number" ? (
                  <>
                    All of its data is permanently deleted after{" "}
                    <span className="text-foreground font-medium">
                      {new Date(org.purge_after * 1000).toLocaleDateString()}
                    </span>
                    .
                  </>
                ) : (
                  "All of its data is permanently deleted 30 days after it was closed."
                )}{" "}
                Reopen it before then to cancel the deletion and restore access.
              </p>
            </div>
          </div>
          <div className="border-destructive/20 bg-destructive/5 flex items-center justify-end border-t px-6 py-4">
            <Button disabled={!isOwner || reopenBusy} onClick={() => setReopenOpen(true)}>
              <RotateCcw className="size-4" /> Reopen organization
            </Button>
          </div>
        </Card>
      ) : null}

      {/* ── Close organization ── */}
      {closing ? null : (
        <Card className="border-destructive/30 gap-0 border p-0">
          <div className="flex items-start gap-4 px-6 py-5">
            <span className="bg-destructive/10 text-destructive mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
              <TriangleAlert className="size-4" />
            </span>
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-base font-medium">
                Close this organization
              </h3>
              <p className="text-muted-foreground text-sm">
                {/* Name the window. "the grace period" is only meaningful to someone who already
                  knows how long it is, which is nobody reading this for the first time. */}
                Close the organization and schedule its data for deletion. You can reopen
                it within 30 days; after that the data is gone for good.
              </p>
            </div>
          </div>

          <div className="border-destructive/20 space-y-4 border-t px-6 py-5">
            <ul className="space-y-2.5">
              {CONSEQUENCES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm">
                  <Icon className="text-destructive mt-0.5 size-4 shrink-0" />
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
                I understand this closes the organization and schedules all of its data
                for permanent deletion.
              </span>
            </label>
          </div>

          <div className="border-destructive/20 bg-destructive/5 flex items-center justify-end border-t px-6 py-4">
            <Button
              variant="destructive"
              disabled={!isOwner || !acknowledged}
              onClick={() => setCloseOpen(true)}
            >
              <TriangleAlert className="size-4" /> Close organization
            </Button>
          </div>
        </Card>
      )}

      {/* Reopen — the safe direction, so a plain confirmation rather than a typed slug. */}
      <Dialog open={reopenOpen} onOpenChange={(o) => !reopenBusy && setReopenOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this organization?</DialogTitle>
            <DialogDescription>
              The scheduled deletion is cancelled, and employees and admins can sign in
              again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReopenOpen(false)}
              disabled={reopenBusy}
            >
              Cancel
            </Button>
            <Button onClick={handleReopen} disabled={reopenBusy}>
              {reopenBusy ? "Reopening…" : "Reopen organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmations (typed-slug) ── */}
      <ConfirmSlugDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export organization data?"
        description={
          <>
            This starts a background export of your entire organization. Type your{" "}
            <span className="text-foreground font-medium">workspace slug</span> to
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
            This closes the organization and schedules all data for deletion. Type your{" "}
            <span className="text-foreground font-medium">workspace slug</span> to
            confirm.
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
