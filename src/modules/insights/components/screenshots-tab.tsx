"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Loader2,
  Search,
  ShieldOff,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
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
import { CaptureNowButton } from "@/modules/agents/components/capture-now-button";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { useScreenshots } from "../use-screenshots";
import {
  getScreenshotReport,
  runScreenshotReports,
  type ScreenshotReport,
  type ShotRow,
} from "../services/insights.service";
import { AiReportCard } from "./ai-report-card";

/**
 * Screenshot gallery — the preview's polished monitoring surface (AI screenshot-report hero,
 * search + department filter + review toggle, employee-grouped tiles, and an immersive fullscreen
 * viewer), wired onto the **real** pii-gated grid (`GET /v1/insights/screenshots`, LLD §14). Each
 * shot is a presigned image ordered by capture time, so the grid doubles as the day's timeline.
 *
 * **Real, monitoring-fed.** Where the backend has no field, the element stays but degrades honestly:
 * the grid exposes no per-shot activity %, so the hero's "Avg activity" reads "—". The **per-shot AI
 * read is wired** — the fullscreen viewer fetches each frame's `vision_map` report on open (category,
 * work-relatedness, a one-line description, a flag) and offers to generate it when the day hasn't been
 * analyzed. Nothing is fabricated — a day is empty until the desktop agent captures.
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
  // Default to today; client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(isoOf(new Date())), []);
  const today = isoOf(new Date());

  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>(ALL_DEPTS);
  const [flag, setFlag] = useState<"all" | "flagged">("all");
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  /**
   * The employee whose captures are open, or `null` for the gallery.
   *
   * Stored as a **user id, not the group object**, so the detail view keeps following live data: the
   * grid re-fetches on paging and date change, and holding a snapshot would freeze the open employee
   * on the frames that existed when they were clicked.
   */
  const [openUser, setOpenUser] = useState<string | null>(null);

  const { shots, loading, loadingMore, error, hasMore, loadMore, reload } =
    useScreenshots(date);
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

  if (openUser) {
    // Deliberately built from `scopedShots`, **not** the gallery's `filteredShots`: the detail view
    // has its own review/time filters, so inheriting the gallery's "Needs review" toggle would show
    // a filtered day while claiming to be the employee's full day. Scope (who you may see) still
    // applies — that is a permission boundary, not a filter.
    const mine = scopedShots.filter((s) => s.user_id === openUser);
    const emp = dirById.get(openUser);
    const deptId = emp?.department_id;
    return (
      <EmployeeCaptures
        userId={openUser}
        name={nameOf(openUser)}
        dept={deptId ? deptLabel(deptId) : "—"}
        device={mine.find((s) => s.device)?.device ?? ""}
        shots={mine}
        date={date}
        nameOf={nameOf}
        onBack={() => setOpenUser(null)}
        onCaptured={reload}
      />
    );
  }

  return (
    <div className="space-y-5" data-tour="shots:review">
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
            <DatePicker
              value={date}
              max={today}
              onChange={setDate}
              className="w-36"
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
                  onOpen={() => setOpenUser(g.userId)}
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
        date={date}
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
 * below, and the per-frame AI read (`ShotAiReport`) hangs under the metadata. Prev/next arrows step
 * across every loaded shot (also ←/→), clamped at the ends. Withheld shots show the privacy
 * placeholder in the pane rather than an image (and no AI read — a withheld frame never reached the
 * model).
 */
function Lightbox({
  shots,
  index,
  date,
  nameOf,
  onIndexChange,
  onClose,
}: {
  shots: ShotRow[];
  index: number | null;
  /** The day being reviewed — needed to fetch/generate the per-frame AI report. */
  date: string;
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
  // How many monitors this one moment was photographed on — frames of a capture share `captured_at`.
  const monitorsInCapture = shot
    ? shots.filter((s) => s.captured_at === shot.captured_at).length
    : 0;

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
                {shot.device ? (
                  <PanelDetail label="Device" value={shot.device} />
                ) : null}
                {/*
                  Only shown on multi-monitor machines. `display` is 0-based on the wire and +1 only
                  here for the label, so "Monitor 1 of 2" reads naturally while the sort order stays
                  the physical one. A single-display capture says nothing rather than "1 of 1".
                */}
                {monitorsInCapture > 1 ? (
                  <PanelDetail
                    label="Monitor"
                    value={`${(shot.display ?? 0) + 1} of ${monitorsInCapture}`}
                  />
                ) : null}
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
              {/* The vision model's read of this frame. A withheld frame was never sent to the model,
                  so there's nothing to show. */}
              {!withheld ? (
                <div className="mx-auto w-full max-w-7xl border-t border-white/10 px-6 py-4 sm:px-8">
                  <ShotAiReport
                    key={`${shot.user_id}:${shot.shot_id}`}
                    shotId={shot.shot_id}
                    userId={shot.user_id}
                    date={date}
                  />
                </div>
              ) : null}
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

/**
 * The vision model's read of one screenshot (`vision_map`), fetched on demand when the frame opens.
 *
 * The model runs per-day (not on capture), so a just-captured frame legitimately has no report yet —
 * that's a 404, surfaced as "not analyzed" with a Generate action, not an error. Generating runs the
 * day's map (spends the org's AI budget, needs `monitoring:manage`); the server enforces it, so a
 * viewer who lacks the permission gets a clear message instead of a silent no-op.
 */
type AiState =
  | { kind: "loading" }
  | { kind: "loaded"; report: ScreenshotReport }
  | { kind: "none" }
  | { kind: "error"; message: string };

function ShotAiReport({
  shotId,
  userId,
  date,
}: {
  shotId: string;
  userId: string;
  date: string;
}) {
  const [state, setState] = useState<AiState>({ kind: "loading" });
  const [running, setRunning] = useState(false);

  // Returns the next state rather than setting it, so `generate` can inspect the result (did the run
  // actually produce a report?) without racing an async setState.
  const fetchReport = useCallback(async (): Promise<AiState> => {
    try {
      const report = await getScreenshotReport(shotId, date, userId);
      return { kind: "loaded", report };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return { kind: "none" };
      return {
        kind: "error",
        message: e instanceof ApiError ? e.message : "Couldn't load the AI read.",
      };
    }
  }, [shotId, userId, date]);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void fetchReport().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [fetchReport]);

  const generate = async () => {
    setRunning(true);
    try {
      // Scoped to **this** frame. Without `shotId` the server maps the whole day — dozens of model
      // calls against a 28s Lambda, which timed out and came back as a bare gateway 500.
      const run = await runScreenshotReports(date, userId, shotId);
      const next = await fetchReport();
      // Still nothing after a run? Explain why (plan doesn't include screenshots, frame withheld by
      // privacy, provider not configured or unreachable) instead of silently re-showing
      // "not analyzed", which reads as the button having done nothing at all.
      if (next.kind === "none") {
        setState({
          kind: "error",
          message: run.reason
            ? `Couldn't analyze this frame — ${run.reason}.`
            : "Couldn't analyze this frame. Try again in a moment.",
        });
      } else {
        setState(next);
      }
    } catch (e) {
      setState({
        kind: "error",
        message:
          e instanceof ApiError
            ? e.status === 403
              ? "You don't have permission to run AI analysis."
              : e.message
            : "Couldn't run AI analysis.",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/45">
        <Sparkles className="size-3.5" /> AI read
      </div>

      {state.kind === "loading" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="size-4 animate-spin" /> Loading the AI read…
        </p>
      )}

      {state.kind === "loaded" && <AiReadBody report={state.report} />}

      {state.kind === "none" && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/60">This frame hasn&apos;t been analyzed yet.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={running}
            onClick={generate}
            className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Generate AI report
              </>
            )}
          </Button>
        </div>
      )}

      {state.kind === "error" && <p className="mt-2 text-sm text-destructive">{state.message}</p>}
    </div>
  );
}

/** The rendered report — one-line description + category / work-related / flag badges + provenance. */
function AiReadBody({ report }: { report: ScreenshotReport }) {
  const catTone =
    report.category === "distracting"
      ? "bg-destructive/20 text-destructive"
      : report.category === "productive"
        ? "bg-success/20 text-success"
        : "bg-white/10 text-white/70";
  return (
    <div className="mt-2 space-y-2">
      <p className="max-w-3xl text-sm leading-relaxed text-white/90">{report.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-medium capitalize", catTone)}>
          {report.category}
        </span>
        <span className="rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">
          {report.work_related ? "Work-related" : "Not work-related"}
        </span>
        {report.flag ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/20 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <Flag className="size-3" /> Flagged
          </span>
        ) : null}
      </div>
      {report.flag && report.flag_reason ? (
        <p className="text-[13px] text-destructive/90">{report.flag_reason}</p>
      ) : null}
      <p className="text-[11px] text-white/35">
        AI analysis
        {report.confidence > 0 ? ` · ${Math.round(report.confidence * 100)}% confidence` : ""}
      </p>
    </div>
  );
}

/**
 * One **capture** — a single moment, across every monitor photographed at it.
 *
 * The agent photographs every connected display in the same cycle and stamps them with an identical
 * `captured_at`, so a dual-monitor machine produces two rows for one moment. Grouping on
 * `captured_at` turns those back into the single event they actually were. Without it, a
 * two-monitor employee appears to have twice as many "screenshots" as moments actually observed.
 */
interface Capture {
  key: string;
  capturedAt: number;
  /** Ordered by `display`, so index 0 is always the primary monitor. */
  monitors: ShotRow[];
  flagged: boolean;
  /** The frame the tile shows: the flagged monitor if any, else the primary. */
  cover: ShotRow;
}

function groupCaptures(shots: ShotRow[]): Capture[] {
  const byMoment = new Map<number, ShotRow[]>();
  for (const s of shots) {
    const list = byMoment.get(s.captured_at);
    if (list) list.push(s);
    else byMoment.set(s.captured_at, [s]);
  }
  return [...byMoment.entries()]
    // Newest first: the useful frame is almost always the most recent one — especially right after
    // a "Capture now", where the whole point is to see what just came back. The lightbox inherits
    // this order, so prev/next walks the grid exactly as it reads.
    .sort((a, b) => b[0] - a[0])
    .map(([capturedAt, group]) => {
      const monitors = [...group].sort(
        (a, b) => (a.display ?? 0) - (b.display ?? 0),
      );
      return {
        key: String(capturedAt),
        capturedAt,
        monitors,
        flagged: monitors.some((s) => s.flagged),
        // Lead with the frame that earned the flag — a reviewer should see *why* it is flagged
        // without first clicking past whichever monitor happens to be primary.
        cover: monitors.find((s) => s.flagged) ?? monitors[0],
      };
    });
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * One employee's captures for the selected day — the level that was missing.
 *
 * The gallery used to open the full-screen viewer straight from an employee tile, skipping this
 * entirely: there was no way to see what an employee's day looked like, or to find the flagged
 * frames within it, without paging a carousel one frame at a time.
 *
 * Scoped to the day picked on the board (owner decision, 2026-07-22). That matches how the capture
 * index is partitioned — one partition per tenant-day — so this view reuses the query the board
 * already made instead of fanning out across dates.
 */
function EmployeeCaptures({
  userId,
  name,
  dept,
  device,
  shots,
  date,
  nameOf,
  onBack,
  onCaptured,
}: {
  /** Whose captures these are — the target for an on-demand capture (device resolved from it). */
  userId: string;
  name: string;
  dept: string;
  device: string;
  shots: ShotRow[];
  date: string;
  nameOf: (id: string) => string;
  onBack: () => void;
  /** Refetch the day's grid once the device confirms a capture landed. */
  onCaptured: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [flag, setFlag] = useState<"all" | "flagged">("all");
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const allCaptures = useMemo(() => groupCaptures(shots), [shots]);

  // Filtering happens at the **capture** level so a moment is kept or dropped whole. Filtering
  // individual frames would let a capture render with one of its two monitors silently missing.
  const captures = useMemo(
    () =>
      allCaptures.filter((c) => {
        const t = hhmm(c.capturedAt);
        if (from && t < from) return false;
        if (to && t > to) return false;
        if (flag === "flagged" && !c.flagged) return false;
        return true;
      }),
    [allCaptures, from, to, flag],
  );

  // The viewer walks every monitor of every visible capture in grid order (newest first), so the
  // arrow keys move through the day exactly as it reads rather than skipping second monitors.
  const flat = useMemo(() => captures.flatMap((c) => c.monitors), [captures]);
  const firstIndexOfCapture = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const c of captures) {
      m.set(c.key, i);
      i += c.monitors.length;
    }
    return m;
  }, [captures]);

  const monitorCount = useMemo(
    () => new Set(shots.map((s) => s.display ?? 0)).size,
    [shots],
  );
  const flaggedCount = allCaptures.filter((c) => c.flagged).length;
  const dirty = from !== "" || to !== "" || flag !== "all";

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ChevronLeft className="size-4" /> All employees
      </Button>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-soft">
        <Avatar className="size-12">
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {dept}
            {device ? " · " + device : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <Summary label="Captures" value={allCaptures.length} />
          <Summary label="Monitors" value={monitorCount} />
          <Summary
            label="Needs review"
            value={flaggedCount}
            tone={flaggedCount > 0 ? "text-destructive" : undefined}
          />
          {/* On-demand capture belongs here rather than only on the device page: this is where
              someone is already looking at a person's frames and wants a current one. The device
              is resolved from the user inside the button. */}
          <CaptureNowButton userId={userId} onCaptured={onCaptured} />
        </div>
      </div>

      {/* Filters — within the selected day */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="From">
          <TimePicker value={from} onChange={setFrom} className="w-32" />
        </Field>
        <Field label="To">
          <TimePicker value={to} onChange={setTo} className="w-32" />
        </Field>
        <Field label="Show">
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="emp-flag"
                checked={flag === "all"}
                onChange={() => setFlag("all")}
                style={{ accentColor: "var(--primary)" }}
              />
              All
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="emp-flag"
                checked={flag === "flagged"}
                onChange={() => setFlag("flagged")}
                style={{ accentColor: "var(--primary)" }}
              />
              Needs review
            </label>
          </div>
        </Field>
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setFrom("");
              setTo("");
              setFlag("all");
            }}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{captures.length}</span>{" "}
        {captures.length === 1 ? "capture" : "captures"}
        {monitorCount > 1 ? " · " + monitorCount + " monitors" : ""} on{" "}
        {dateLabel(date)} · select one to view it full screen.
      </p>

      {captures.length === 0 ? (
        <EmptyState
          icon={flag === "flagged" ? Flag : Camera}
          title={
            flag === "flagged"
              ? "Nothing flagged for review"
              : "No captures in this range"
          }
          description={
            flag === "flagged"
              ? "No captures for this employee on this day were in a distracting app."
              : "Try widening the time range."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {captures.map((c) => (
            <CaptureCard
              key={c.key}
              capture={c}
              monitorCount={monitorCount}
              onOpen={() => setViewerIdx(firstIndexOfCapture.get(c.key) ?? 0)}
            />
          ))}
        </div>
      )}

      <Lightbox
        shots={flat}
        index={viewerIdx}
        date={date}
        nameOf={nameOf}
        onIndexChange={setViewerIdx}
        onClose={() => setViewerIdx(null)}
      />
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/** One capture tile: the cover frame, its app, time, monitor count and review flag. */
function CaptureCard({
  capture,
  monitorCount,
  onOpen,
}: {
  capture: Capture;
  monitorCount: number;
  onOpen: () => void;
}) {
  const shot = capture.cover;
  const withheld = shot.redacted || !shot.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group overflow-hidden rounded-2xl bg-card text-left shadow-soft transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        capture.flagged && "ring-1 ring-destructive/40",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {withheld ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShieldOff className="size-6" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shot.url}
            alt={shot.app + " at " + hhmm(capture.capturedAt)}
            className="size-full object-cover"
            loading="lazy"
          />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {shot.app || "—"}
        </span>
        {capture.flagged ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-destructive px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Flag className="size-3" /> Needs review
          </span>
        ) : monitorCount > 1 ? (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {capture.monitors.length} of {monitorCount}
          </span>
        ) : null}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {hhmm(capture.capturedAt)}
        </span>
      </div>
    </button>
  );
}
