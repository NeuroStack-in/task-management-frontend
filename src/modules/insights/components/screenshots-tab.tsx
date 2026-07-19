"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  ShieldOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { useScreenshots } from "../use-screenshots";
import type { ShotRow } from "../services/insights.service";

/**
 * Screenshot gallery — the pii-gated monitoring grid (`GET /v1/insights/screenshots`, LLD §14),
 * wearing the preview's polished tiles + immersive fullscreen viewer. Each shot is a presigned image
 * ordered by capture time, so the grid doubles as the day's timeline. Shots the privacy gate withheld
 * (`redacted` / empty `url`) render a placeholder, never an image.
 *
 * **Real, monitoring-fed:** a day is empty until the desktop agent captures — an honest empty state,
 * never fabricated frames. The preview's per-shot activity %, flag reasons, monitor sets and
 * per-employee rollups are dropped: the server exposes none of those fields, and inventing them would
 * be fiction.
 */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
/** A short, stable label for a raw user id (no name field on the shot row). */
function shortUser(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

const ALL_USERS = "__all__";

export function ScreenshotsTab() {
  // Default to yesterday (a completed capture day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  const [userId, setUserId] = useState<string>(ALL_USERS);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const today = isoOf(new Date());
  const filterUser = userId === ALL_USERS ? undefined : userId;
  const { shots, loading, loadingMore, error, hasMore, loadMore } = useScreenshots(
    date,
    filterUser,
  );

  // Accumulate every user id ever seen so the filter options stay stable even
  // after a filter collapses the visible set to a single user.
  const [knownUsers, setKnownUsers] = useState<string[]>([]);
  useEffect(() => {
    if (shots.length === 0) return;
    setKnownUsers((prev) => {
      const set = new Set(prev);
      for (const s of shots) set.add(s.user_id);
      const next = [...set].sort();
      return next.length === prev.length ? prev : next;
    });
  }, [shots]);

  const withheld = useMemo(() => shots.filter((s) => s.redacted || !s.url).length, [shots]);

  return (
    <div className="space-y-5">
      {/* Controls: day nav + optional per-person filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            disabled={!date}
            onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-36"
            aria-label="Capture date"
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            disabled={!date || date >= today}
            onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {knownUsers.length > 0 ? (
          <Select value={userId} onValueChange={(v) => setUserId(v as string)}>
            <SelectTrigger className="h-8 w-52" aria-label="Filter by person">
              <SelectValue>
                {(v) => (v == null || v === ALL_USERS ? "All people" : shortUser(String(v)))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_USERS}>All people</SelectItem>
              {knownUsers.map((u) => (
                <SelectItem key={u} value={u}>
                  {shortUser(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {shots.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{shots.length}</span>{" "}
          {shots.length === 1 ? "screenshot" : "screenshots"}
          {withheld > 0 ? ` · ${withheld} withheld by privacy policy` : ""}
          {hasMore ? " · more available" : ""} · select one to view it full screen.
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <Loader label="Loading screenshots…" />
        </div>
      ) : error ? (
        <EmptyState icon={ShieldOff} title="Couldn't load screenshots" description={error} />
      ) : shots.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No screenshots for this day"
          description="Screenshots appear here once the desktop agent captures them. Nothing was reported for the selected day."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shots.map((shot, i) => (
              <ShotCard key={shot.shot_id} shot={shot} onOpen={() => setViewerIdx(i)} />
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-1">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Lightbox
        shots={shots}
        index={viewerIdx}
        onIndexChange={setViewerIdx}
        onClose={() => setViewerIdx(null)}
      />
    </div>
  );
}

function ShotCard({ shot, onOpen }: { shot: ShotRow; onOpen: () => void }) {
  const withheld = shot.redacted || !shot.url;
  return (
    <Card
      className="group cursor-pointer gap-0 overflow-hidden p-0 transition hover:ring-1 hover:ring-primary/40"
      onClick={onOpen}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {withheld ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center">
            <EyeOff className="size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Withheld by privacy policy
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.url}
            alt={`${shot.app} screenshot`}
            loading="lazy"
            className="size-full max-w-full object-cover transition group-hover:scale-[1.02]"
          />
        )}
        <div className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {shot.app || "Unknown app"}
        </div>
        {withheld ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-muted text-muted-foreground shadow-sm">
            Redacted
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 text-sm">
        <span className="truncate text-xs text-muted-foreground">{shortUser(shot.user_id)}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatTime(shot.captured_at)}
        </span>
      </div>
    </Card>
  );
}

/**
 * Fullscreen viewer — the image fills its own letterboxed pane, metadata sits in a distinct section
 * below. Prev/next arrows step across the loaded shots (also ←/→), clamped at the ends. Withheld
 * shots show the privacy placeholder in the pane rather than an image.
 */
function Lightbox({
  shots,
  index,
  onIndexChange,
  onClose,
}: {
  shots: ShotRow[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = shots.length;
  const shot = index !== null ? (shots[index] ?? null) : null;
  const open = shot !== null;

  useEffect(() => {
    if (!open || index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange]);

  const atStart = index === 0;
  const atEnd = index !== null && index === count - 1;
  const withheld = shot ? shot.redacted || !shot.url : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 ring-0 sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Screenshot viewer</DialogTitle>
          <DialogDescription>
            {shot ? `${shot.app || "Unknown app"} — ${shortUser(shot.user_id)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {shot ? (
          <>
            {/* Image pane */}
            <div className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
              {withheld ? (
                <div className="flex flex-col items-center gap-3 text-center text-white/70">
                  <EyeOff className="size-8" />
                  <p className="text-sm font-medium">Withheld by privacy policy</p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shot.url}
                  alt={`${shot.app} screenshot`}
                  className="max-h-full max-w-full object-contain"
                />
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <X className="size-5" />
              </button>

              {count > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => index !== null && index > 0 && onIndexChange(index - 1)}
                    disabled={atStart}
                    aria-label="Previous screenshot"
                    className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-opacity duration-200 hover:bg-white/25 focus-visible:opacity-100 disabled:pointer-events-none disabled:!opacity-0 sm:left-5"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => index !== null && index < count - 1 && onIndexChange(index + 1)}
                    disabled={atEnd}
                    aria-label="Next screenshot"
                    className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-opacity duration-200 hover:bg-white/25 focus-visible:opacity-100 disabled:pointer-events-none disabled:!opacity-0 sm:right-5"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              ) : null}

              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium tabular-nums text-white/80 backdrop-blur-sm">
                {(index ?? 0) + 1} / {count}
              </span>
            </div>

            {/* Metadata section */}
            <div className="shrink-0 border-t border-white/10 bg-[#0d0e13]">
              <div className="mx-auto flex w-full max-w-7xl flex-wrap items-start gap-x-10 gap-y-4 px-6 py-5 sm:px-8">
                <PanelDetail label="Application" value={shot.app || "Unknown app"} />
                <PanelDetail label="Person" value={shortUser(shot.user_id)} />
                <PanelDetail label="Captured" value={formatDateTime(shot.captured_at)} />
                {shot.blur_level > 0 ? (
                  <PanelDetail label="Blur level" value={String(shot.blur_level)} />
                ) : null}
                {withheld ? (
                  <PanelDetail label="Status" value="Redacted by privacy policy" className="text-destructive" />
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PanelDetail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</dt>
      <dd className={cn("mt-1 break-words font-medium text-white", className)}>{value}</dd>
    </div>
  );
}
