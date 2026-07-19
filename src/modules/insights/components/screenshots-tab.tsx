"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Search,
  ShieldOff,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useDataScope } from "@/hooks/use-data-scope";
import { useDirectory } from "@/hooks/use-directory";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useScreenshots } from "../use-screenshots";
import type { ShotRow } from "../services/insights.service";
import { AiReportCard } from "./ai-report-card";

/**
 * Screenshot gallery — the preview's polished monitoring surface (AI screenshot-report hero,
 * search + department filter + review toggle, employee-grouped tiles, and an immersive fullscreen
 * viewer), wired onto the **real** pii-gated grid (`GET /v1/insights/screenshots`, LLD §14). Each
 * shot is a presigned image ordered by capture time, so the grid doubles as the day's timeline.
 *
 * **Real, monitoring-fed.** Where the backend has no field, the element stays but degrades honestly:
 * the server exposes no per-shot flag, no per-shot activity %, and no screenshot-specific AI, so the
 * hero's "Needs review" / "Avg activity" read "—", the "Needs review" toggle yields an honest empty,
 * and the tiles/viewer show only the real app + capture time. Nothing is fabricated — a day is empty
 * until the desktop agent captures.
 */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
function dateLabel(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
/** A short, stable label for a raw user id (fallback when the directory has no name). */
function shortUser(id: string): string {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}
/** Latest capture in a group — the tile's cover. */
function coverOf(shots: ShotRow[]): ShotRow {
  return shots.reduce((a, b) => (b.captured_at > a.captured_at ? b : a), shots[0]);
}

const ALL_DEPTS = "all";

interface EmployeeGroup {
  userId: string;
  shots: ShotRow[];
}

export function ScreenshotsTab() {
  // Default to yesterday (a completed capture day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);
  const today = isoOf(new Date());

  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>(ALL_DEPTS);
  const [flag, setFlag] = useState<"all" | "flagged">("all");
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const { shots, loading, loadingMore, error, hasMore, loadMore } = useScreenshots(date);
  const { inScope, loading: scopeLoading } = useDataScope();
  const { employees: directory } = useDirectory();

  // department_id → name, best-effort (the board still works on ids if this fails).
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let live = true;
    departmentMap()
      .then((m) => live && setDeptNames(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Directory join: user_id → { name, department_id }. Names/departments come from the real
  // roster; anyone not in it falls back to a shortened id and no department.
  const dirById = useMemo(
    () => new Map(directory.map((e) => [e.user_id, e])),
    [directory],
  );
  const deptLabel = (id: string) => deptNames.get(id) ?? id;

  // Team leads only see their own team's shots; org roles see all.
  const scopedShots = useMemo(
    () => shots.filter((s) => inScope(s.user_id)),
    [shots, inScope],
  );

  // Hero metrics — REAL where the backend has a source, "—" where it doesn't.
  const monitored = useMemo(
    () => new Set(scopedShots.map((s) => s.user_id)).size,
    [scopedShots],
  );
  const total = scopedShots.length;
  // Real, from the server's app classification: a distracting-app capture is flagged for review.
  const needsReview = useMemo(
    () => scopedShots.filter((s) => s.flagged).length,
    [scopedShots],
  );
  // On-task rate = the non-distracting share of the day's captures (real, from classification).
  const onTaskPct = total > 0 ? Math.round(((total - needsReview) / total) * 100) : 0;

  // Department options = departments present among the day's captured employees.
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of scopedShots) {
      const d = dirById.get(s.user_id)?.department_id;
      if (d) set.add(d);
    }
    return [...set].sort();
  }, [scopedShots, dirById]);

  const q = query.trim().toLowerCase();
  const filteredShots = useMemo(() => {
    return scopedShots.filter((s) => {
      // "Needs review" → the real distracting-app captures (server-classified).
      if (flag === "flagged" && !s.flagged) return false;
      const emp = dirById.get(s.user_id);
      if (dept !== ALL_DEPTS && emp?.department_id !== dept) return false;
      if (q) {
        const name = emp?.name?.toLowerCase() ?? "";
        if (!name.includes(q) && !s.user_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [scopedShots, flag, dept, q, dirById]);

  // One tile per employee, grouped by user_id in first-seen (time) order.
  const groups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, ShotRow[]>();
    for (const s of filteredShots) {
      const list = map.get(s.user_id);
      if (list) list.push(s);
      else map.set(s.user_id, [s]);
    }
    return [...map.entries()].map(([userId, list]) => ({ userId, shots: list }));
  }, [filteredShots]);

  // Flat, grouped order for the lightbox so prev/next walks the whole visible day.
  const flatShots = useMemo(() => groups.flatMap((g) => g.shots), [groups]);
  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    flatShots.forEach((s, i) => m.set(s.shot_id, i));
    return m;
  }, [flatShots]);

  const withheld = useMemo(
    () => filteredShots.filter((s) => s.redacted || !s.url).length,
    [filteredShots],
  );

  const summary =
    total === 0
      ? `No screenshots were captured on ${dateLabel(date)}. Frames appear here once the desktop agent starts reporting for the day.`
      : `${total.toLocaleString()} ${total === 1 ? "screenshot" : "screenshots"}${
          hasMore ? "+" : ""
        } captured across ${monitored} ${
          monitored === 1 ? "employee" : "employees"
        } on ${dateLabel(date)}. ${
          needsReview > 0
            ? `${needsReview} ${needsReview === 1 ? "capture" : "captures"} in a distracting app — review those first.`
            : "No distracting-app captures flagged."
        } On-task rate sits at ${onTaskPct}%.`;

  const nameOf = (id: string) => dirById.get(id)?.name ?? shortUser(id);

  return (
    <div className="space-y-5">
      <AiReportCard
        title="AI screenshot report"
        summary={summary}
        metrics={[
          { label: "Monitored", value: monitored },
          {
            label: "Screenshots",
            value: total.toLocaleString(),
            hint: hasMore ? "so far" : undefined,
          },
          { label: "Needs review", value: needsReview },
          { label: "Avg activity", value: `${onTaskPct}%`, hint: "on-task rate" },
        ]}
      />

      {/* Filters: day · search · department · review toggle */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="Date">
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
        </Field>

        <Field label="Search">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Employee name…"
              className="h-8 w-56 pl-8"
            />
          </div>
        </Field>

        {departments.length > 0 ? (
          <Field label="Department">
            <Select value={dept} onValueChange={(v) => setDept(v as string)}>
              <SelectTrigger className="h-8 w-48" aria-label="Department">
                <SelectValue>
                  {(v) =>
                    v == null || v === ALL_DEPTS
                      ? "All departments"
                      : deptLabel(String(v))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={ALL_DEPTS}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {deptLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <fieldset className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Show</span>
          <div className="flex h-8 items-center gap-3">
            {(["all", "flagged"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="ss-flag-filter"
                  className="size-4"
                  style={{ accentColor: "var(--primary)" }}
                  checked={flag === opt}
                  onChange={() => setFlag(opt)}
                />
                {opt === "all" ? "All" : "Needs review"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {filteredShots.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{groups.length}</span>{" "}
          {groups.length === 1 ? "person" : "people"} ·{" "}
          <span className="font-medium text-foreground">{filteredShots.length}</span>{" "}
          {filteredShots.length === 1 ? "screenshot" : "screenshots"}
          {withheld > 0 ? ` · ${withheld} withheld by privacy policy` : ""}
          {hasMore ? " · more available" : ""} · select one to view it full screen.
        </p>
      ) : null}

      {loading || scopeLoading ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <Loader label="Loading screenshots…" />
        </div>
      ) : error ? (
        <EmptyState icon={ShieldOff} title="Couldn't load screenshots" description={error} />
      ) : scopedShots.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No screenshots for this day"
          description="Screenshots appear here once the desktop agent captures them. Nothing was reported for the selected day."
        />
      ) : flag === "flagged" && filteredShots.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing flagged for review"
          description="No captures on this day were in a distracting app. Flagged captures appear here for review."
        />
      ) : filteredShots.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people match"
          description="Try a different name or department."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.map((g) => {
              const cover = coverOf(g.shots);
              const emp = dirById.get(g.userId);
              const deptId = emp?.department_id;
              return (
                <EmployeeCard
                  key={g.userId}
                  name={emp?.name ?? shortUser(g.userId)}
                  dept={deptId ? deptLabel(deptId) : "—"}
                  cover={cover}
                  count={g.shots.length}
                  flaggedCount={g.shots.filter((s) => s.flagged).length}
                  onOpen={() => setViewerIdx(indexOf.get(cover.shot_id) ?? 0)}
                />
              );
            })}
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
        shots={flatShots}
        index={viewerIdx}
        nameOf={nameOf}
        onIndexChange={setViewerIdx}
        onClose={() => setViewerIdx(null)}
      />
    </div>
  );
}

/**
 * Employee tile — the preview's gallery card: a cover screenshot (the latest capture) with the real
 * app label and capture time, over the person's name + department + avatar (initials fallback, no
 * uploaded picture on the lean roster). The preview's red flag-count badge is omitted: the backend
 * has no per-shot flag, so inventing a number would be fiction. A withheld cover shows the privacy
 * placeholder rather than an image.
 */
function EmployeeCard({
  name,
  dept,
  cover,
  count,
  flaggedCount,
  onOpen,
}: {
  name: string;
  dept: string;
  cover: ShotRow;
  count: number;
  flaggedCount: number;
  onOpen: () => void;
}) {
  const withheld = cover.redacted || !cover.url;
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
            src={cover.url}
            alt={`${name} — ${cover.app}`}
            loading="lazy"
            className="size-full max-w-full object-cover transition group-hover:scale-[1.02]"
          />
        )}
        <div className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {cover.app || "Unknown app"}
        </div>
        {flaggedCount > 0 ? (
          <Badge className="absolute right-2 top-2 gap-1 border-transparent bg-destructive text-destructive-foreground shadow-sm">
            <Flag className="size-3" />
            {flaggedCount}
          </Badge>
        ) : withheld ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-muted text-muted-foreground shadow-sm">
            Redacted
          </Badge>
        ) : null}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {count} {count === 1 ? "shot" : "shots"}
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur-sm">
          {formatTime(cover.captured_at)}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar>
          <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{dept}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Fullscreen viewer — the image fills its own letterboxed pane, metadata sits in a distinct section
 * below. Prev/next arrows step across every loaded shot (also ←/→), clamped at the ends. Withheld
 * shots show the privacy placeholder in the pane rather than an image. The preview's per-capture
 * activity % / flag reason / AI read are dropped — the backend exposes none of them.
 */
function Lightbox({
  shots,
  index,
  nameOf,
  onIndexChange,
  onClose,
}: {
  shots: ShotRow[];
  index: number | null;
  nameOf: (id: string) => string;
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
            {shot ? `${shot.app || "Unknown app"} — ${nameOf(shot.user_id)}` : ""}
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
                <PanelDetail label="Person" value={nameOf(shot.user_id)} />
                <PanelDetail label="Captured" value={formatDateTime(shot.captured_at)} />
                {shot.blur_level > 0 ? (
                  <PanelDetail label="Blur level" value={String(shot.blur_level)} />
                ) : null}
                {withheld ? (
                  <PanelDetail
                    label="Status"
                    value="Redacted by privacy policy"
                    className="text-destructive"
                  />
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
