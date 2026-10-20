"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, EyeOff, Flag, ImageOff, Loader2, Search, ShieldOff, Sparkles, Trash2, Users, X } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { useDirectory } from "@/hooks/use-directory";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { CaptureNowButton } from "@/modules/agents/components/capture-now-button";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
import { getTrackingPolicy } from "@/modules/agents/services/fleet.service";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate, formatDateTime, personName, UNKNOWN_DEPARTMENT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";
import { useScreenshots } from "../use-screenshots";
import {
  getScreenshotReport,
  getScreenshotDeptSummary,
  regenerateScreenshotDeptSummary,
  runScreenshotReports,
  type ScreenshotDeptSummary,
  type ScreenshotReport,
  type ShotRow,
  awaitsReview,
  reviewScreenshot,
} from "../services/insights.service";
import { EMP_PARAM } from "../lib/employee-scope";
import { AiReportCard } from "./ai-report-card";
import { CaptureEmptyState } from "./capture-empty-state";
import {
  formatGeneratedAt,
  screenshotSummaryProvenance,
  type Provenance,
} from "../lib/ai-provenance";
import { replaceSearch, useInsightsDate, useInsightsDept } from "../use-insights-params";
import {
  captureCountOf,
  counterLabel,
  framePositions,
  nextFlaggedIndex,
  sortGroupsByOpenFlags,
} from "../lib/gallery";

/** `?show=review` opens the gallery on "Needs review" — where the attention panel's link lands. */
const SHOW_PARAM = "show";

/**
 * Screenshot gallery — the preview's polished monitoring surface (AI screenshot-report hero,
 * search + department filter + review toggle, one tile per employee, and a per-employee view with an
 * immersive fullscreen viewer), wired onto the **real** pii-gated grid
 * (`GET /v1/insights/screenshots`, LLD §14). The org-wide day arrives person-then-time; a person's
 * own day is read for that person and shown newest first.
 *
 * **Real, monitoring-fed.** Where the backend has no figure, the element stays but degrades honestly:
 * the hero's "On-task" reads "—" until the vision model has analysed frames for the day. The
 * **per-shot AI read is wired** — the fullscreen viewer fetches each frame's `vision_map` report on
 * open (category, work-relatedness, a one-line description, a flag) and offers to generate it when
 * the frame hasn't been analysed. Nothing is fabricated — a day is empty until the desktop agent
 * captures, and a day that failed to load says so rather than reading as empty.
 */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
/** The one date notation (UX audit XC-06), `""` for an unset day. */
function dateLabel(iso: string): string {
  return iso ? formatDate(iso) : "";
}
function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
/**
 * What to show when the directory has no name for a capture's owner.
 *
 * The directory is the whole roster, so a miss means the person is no longer in it, or the reader
 * can't read the directory (no `employees:view`) — the same wording `fleet-view` uses. It used to
 * render a truncated Cognito `sub`, which is still a raw id and tells the reader nothing.
 */
const OUT_OF_SCOPE = "Outside your directory";
/**
 * Ceiling on the gallery's automatic paging — a backstop against a pathological day, not a target.
 * At the hook's page size (60) this is 1,260 frames including the first page; beyond it the roster
 * stops filling and lists the people it never reached rather than paging forever.
 */
const MAX_AUTO_PAGES = 20;

/**
 * How old a loaded list must be before a broken image is read as an **expired** presigned URL.
 *
 * Read URLs live 15 minutes (`wp_platform::s3::READ_URL_TTL_SECS`) and this page does not poll, so
 * a person reviewed for 20 minutes then scrolled got a page of broken tiles (QA audit 2026-10-08,
 * WP-294). Past this age a failed image refetches the list once — fresh URLs — rather than leaving
 * it broken; younger than it, the image is genuinely unavailable and shows a placeholder.
 */
const URL_STALE_MS = 10 * 60 * 1000;

/**
 * `reload` once a failed image suggests the list's URLs have expired — at most once per
 * {@link URL_STALE_MS}, however many tiles fail together.
 */
function useExpiredUrlRefresh(loadedAt: number, reload: () => void): () => void {
  const asked = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (!loadedAt || now - loadedAt < URL_STALE_MS || now - asked.current < URL_STALE_MS) return;
    asked.current = now;
    reload();
  }, [loadedAt, reload]);
}

/**
 * A screenshot `<img>` that does not stay broken: on an error it shows a placeholder and tells its
 * owner (which refetches if the URL may have expired). A new `src` — after that refetch — is tried
 * afresh.
 */
function ShotImage({
  src,
  alt,
  className,
  lazy = false,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
  onError?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-muted p-3 text-center text-muted-foreground">
        <ImageOff className="size-5" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? "lazy" : undefined}
      onError={() => {
        setFailed(src);
        onError?.();
      }}
    />
  );
}

/** How many of one person's captures to reveal per "Load more" press in their detail view. */
const DETAIL_PAGE = 60;

/**
 * Ceiling on one person's automatic paging in their detail view — at the hook's page size, 1,200
 * frames, well past a full day at a one-minute cadence.
 */
const MAX_USER_PAGES = 20;

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
  // Default to today; client-side to avoid an SSR date mismatch. A `?date=` opens that day instead —
  // the attention panel and the AI cards link a person's screenshots *for the day they are about*
  // (UX audit 2026-10-16, MON-04), which a tab that always opened on today could not honour.
  //
  // The day and the department live in the URL, shared by every Analytics tab (MON-13).
  const searchParams = useSearchParams();
  const [date, setDate, today] = useInsightsDate();

  /**
   * The org's screenshot retention, so this page can say what happened to older days rather than
   * showing an empty grid that looks like a capture failure. `null` until it loads, and on failure —
   * the notice is an explanation, never a precondition for showing the grid.
   *
   * `GET /v1/agent/config` needs only a signed-in user (no permission gate), so anyone who can reach
   * this page can read it.
   */
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    getTrackingPolicy()
      .then((cfg) => live && setRetentionDays(cfg.tracking.retention_days))
      .catch(() => {
        /* no notice rather than a wrong one */
      });
    return () => {
      live = false;
    };
  }, []);

  /**
   * Is the chosen day past the point where the sweep would have deleted it?
   *
   * Compared in whole days against the same window `fleet::retention_sweep` enforces. Deliberately
   * strict (`>`): the boundary day is still being kept, so claiming it was deleted would be the
   * same lie in the other direction.
   */
  const beyondRetention =
    retentionDays !== null &&
    date !== "" &&
    Math.floor(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000,
    ) > retentionDays;

  const [query, setQuery] = useState("");
  const [dept, setDept] = useInsightsDept();
  const [flag, setFlag] = useState<"all" | "flagged">(
    searchParams.get(SHOW_PARAM) === "review" ? "flagged" : "all",
  );
  /**
   * The employee whose captures are open, or `null` for the gallery.
   *
   * Stored as a **user id, not the group object**, so the detail view keeps following live data: the
   * grid re-fetches on paging and date change, and holding a snapshot would freeze the open employee
   * on the frames that existed when they were clicked.
   */
  const [openUser, setOpenUser] = useState<string | null>(null);
  // `?emp=<id>` scopes the whole Analytics hub to one employee (the profile's Analytics button):
  // land straight on that person's day rather than the whole-org gallery. It follows the parameter
  // both ways — "Whole organization" in the scope bar drops it, and this closes the person — while a
  // tile clicked in the gallery opens a person without scoping the other tabs.
  const deepLinkedUser = searchParams.get(EMP_PARAM);
  useEffect(() => {
    setOpenUser(deepLinkedUser);
  }, [deepLinkedUser]);

  // Department-scoped AI narrative of the day's screen activity, judged for the department's role.
  // The backend generates it once per day's frame count and caches it; regenerate forces a fresh one.
  // Falls back to the deterministic template line while it loads or when the model is unavailable.
  const [aiSummary, setAiSummary] = useState<ScreenshotDeptSummary | null>(null);
  /** The (date, department) a Regenerate is running for, or `null`. */
  const [aiRegenFor, setAiRegenFor] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Paused while one person is open: their view reads their own day, and the org-wide gallery read
  // (up to 21 requests) behind it — again on every date step there — was spent on a page nobody was
  // looking at. Leaving the person reloads it (`onBack`).
  const { shots, loading, loadingMore, error, hasMore, loadMore, reload, loadedAt } =
    useScreenshots(openUser ? "" : date);

  /**
   * Page the day to exhaustion instead of making the admin ask for it.
   *
   * The gallery is a roster — one tile per person, each captioned with that person's shot count. A
   * single page can support neither. The org-wide day is read person-then-time, so one page is the
   * first two or three people's whole day (on a day eleven worked), and every count would be "shots
   * in the page" rather than shots in the day. Who appears on the roster must not depend on how far
   * someone scrolled, so the roster loads the whole day up front and "Load more" belongs inside a
   * person's captures, not out here.
   *
   * Bounded, and stops on the first error: `loadMore` leaves the cursor intact when a request fails,
   * so an unguarded effect would retry the same failing page forever.
   */
  const autoPages = useRef(0);
  useEffect(() => {
    autoPages.current = 0;
  }, [date]);
  /**
   * Refetch the day **with a fresh paging budget**. The budget used to reset only on a date change,
   * so every Refresh spent another full day's worth of it, and after a few the roster loaded one
   * page and told the reader the day was "unusually large" (QA audit 2026-10-08, WP-080).
   */
  const reloadDay = useCallback(() => {
    autoPages.current = 0;
    reload();
  }, [reload]);
  const onTileImageError = useExpiredUrlRefresh(loadedAt, reloadDay);
  useEffect(() => {
    if (!hasMore || loading || loadingMore || error) return;
    if (autoPages.current >= MAX_AUTO_PAGES) return;
    autoPages.current += 1;
    loadMore();
  }, [hasMore, loading, loadingMore, error, loadMore]);
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
  const deptLabel = (id: string) =>
    deptNames.get(id) ?? (id ? UNKNOWN_DEPARTMENT : "");

  // Fetch the department-scoped screenshot narrative for the day/department in view. Best-effort: a
  // failure (or the model being off) leaves `aiSummary` null and the card shows the template line.
  const aiLabel = dept === ALL_DEPTS ? undefined : deptNames.get(dept);
  /** What the AI card is about — a response must still match it to land. */
  const aiSelection = `${date}|${dept}`;
  const aiCurrent = useRef(aiSelection);
  useEffect(() => {
    aiCurrent.current = aiSelection;
  }, [aiSelection]);
  // Not while one person is open — the card is not on screen, and a date step there would generate
  // a narrative per day stepped through.
  const aiPaused = openUser !== null;
  /** The selection `aiSummary` belongs to — returning from a person keeps it on screen. */
  const aiLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!date || aiPaused) return;
    let live = true;
    // The title follows the filter at once, so the previous department's (or day's) narrative must
    // not stay under it while the next one generates (QA audit 2026-10-08, WP-279).
    if (aiLoadedFor.current !== aiSelection) {
      setAiSummary(null);
      setAiNotice(null);
    }
    getScreenshotDeptSummary({ department: dept, date, label: aiLabel })
      .then((s) => {
        if (!live) return;
        setAiSummary(s);
        aiLoadedFor.current = aiSelection;
      })
      .catch(() => {
        if (!live) return;
        setAiSummary(null);
        aiLoadedFor.current = aiSelection;
      });
    return () => {
      live = false;
    };
    // Keyed on the label string, not the department map: the map is replaced when it loads, which
    // re-issued this identical request on every visit — two generations on a cache miss
    // (QA audit 2026-10-08, WP-280).
  }, [date, dept, aiLabel, aiPaused, aiSelection]);

  const regenerateAi = async () => {
    if (aiRegenFor === aiSelection || !date) return;
    const started = aiSelection;
    setAiRegenFor(started);
    setAiNotice(null);
    try {
      const fresh = await regenerateScreenshotDeptSummary({
        department: dept,
        date,
        label: aiLabel,
      });
      // A slow re-run must not put one department's narrative under another's title
      // (QA audit 2026-10-08, WP-278).
      if (aiCurrent.current === started) setAiSummary(fresh);
    } catch {
      // Keep the current narrative on a failed re-run, but say it failed.
      if (aiCurrent.current === started) {
        setAiNotice("Couldn't regenerate the report — showing the previous one.");
      }
    } finally {
      setAiRegenFor((k) => (k === started ? null : k));
    }
  };

  // Everyone with screenshot access sees every person's captures — no department cap (owner decision
  // 2026-10-13). This used to keep a team-scoped role to its own department; the server applied the
  // same cap (QA audit WP-085) until the owner reversed it.

  // Hero metrics — REAL where the backend has a source, "—" where it doesn't.
  const monitored = useMemo(
    () => new Set(shots.map((s) => s.user_id)).size,
    [shots],
  );
  const total = shots.length;
  // Flags nobody has handled yet — the AI's verdicts, minus the ones a reviewer confirmed or
  // dismissed (MON-02). Never the app name (owner decision 2026-10-13).
  const needsReview = useMemo(() => shots.filter(awaitsReview).length, [shots]);
  /**
   * How many frames the AI has actually looked at. "Nothing flagged" must never stand in for
   * "nothing checked": minutes after capture, or longer when the provider fails, most of a day can be
   * unanalysed, and the page used to read that as all clear (UX audit 2026-10-16, MON-01).
   */
  const analysed = useMemo(() => shots.filter((s) => s.reviewed === true).length, [shots]);
  const notYetChecked = shots.length - analysed;
  /**
   * The server's narrative and its on-task figure describe only the frames the vision model has
   * **analysed** — and with none analysed its fallback says no screenshots were captured, over a
   * grid of them. So both are used once there are analysed frames, and the local line (which counts
   * the actual captures) speaks until then. "On-task" is the server's figure only: a second,
   * locally-derived "on-task rate" on the same card disagreed with the one the narrative quoted
   * (QA audit 2026-10-08, WP-276).
   */
  const aiAnalysed = aiSummary && aiSummary.metrics.frames > 0 ? aiSummary : null;
  const scopeTotal = useMemo(
    () =>
      dept === ALL_DEPTS
        ? shots.length
        : shots.filter((s) => dirById.get(s.user_id)?.department_id === dept).length,
    [dept, shots, dirById],
  );
  const aiCoverage =
    aiAnalysed && aiAnalysed.metrics.frames < scopeTotal
      ? `Written from the ${aiAnalysed.metrics.frames.toLocaleString()} ${
          aiAnalysed.metrics.frames === 1 ? "screenshot" : "screenshots"
        } the AI has analysed so far — not every capture below has been analysed yet.`
      : null;
  /** The grid has nothing to count *yet* (loading) or could not be read — not an empty day. */
  const countsUnknown = total === 0 && (loading || error !== null);

  // Department options = departments present among the day's captured employees.
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const s of shots) {
      const d = dirById.get(s.user_id)?.department_id;
      if (d) set.add(d);
    }
    return [...set].sort();
  }, [shots, dirById]);

  const q = query.trim().toLowerCase();
  const filteredShots = useMemo(() => {
    return shots.filter((s) => {
      // "Needs review" → the AI's flags nobody has handled yet, and only those (MON-01/MON-02). The
      // app name never flags (owner decision 2026-10-13); a confirmed or dismissed flag has left
      // the queue.
      if (flag === "flagged" && !awaitsReview(s)) return false;
      const emp = dirById.get(s.user_id);
      if (dept !== ALL_DEPTS && emp?.department_id !== dept) return false;
      if (q) {
        const name = emp?.name?.toLowerCase() ?? "";
        if (!name.includes(q) && !s.user_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [shots, flag, dept, q, dirById]);

  // One tile per employee, grouped by user_id — people with flags awaiting review first, most first,
  // then the server's person order (UX audit 2026-10-16, MON-11).
  const groups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, ShotRow[]>();
    for (const s of filteredShots) {
      const list = map.get(s.user_id);
      if (list) list.push(s);
      else map.set(s.user_id, [s]);
    }
    return sortGroupsByOpenFlags([...map.entries()].map(([userId, list]) => ({ userId, shots: list })));
  }, [filteredShots]);

  const withheld = useMemo(
    () => filteredShots.filter((s) => s.redacted || !s.url).length,
    [filteredShots],
  );

  // Says "no screenshots were captured" only when the grid actually loaded empty. While loading, and
  // when every read had failed, it said exactly that over nothing at all (QA audit 2026-10-08, WP-113).
  const summary =
    total === 0 && (loading)
      ? `Loading the screenshots for ${dateLabel(date)}…`
      : total === 0 && error
        ? `The screenshots for ${dateLabel(date)} couldn't be loaded, so there is nothing to summarise yet.`
        : total === 0 && beyondRetention
          ? `Screenshots from ${dateLabel(date)} have been deleted under this organization's retention policy.`
          : total === 0
            ? `No screenshots were captured on ${dateLabel(date)}. Frames appear here once the desktop agent starts reporting for the day.`
            : `${total.toLocaleString()} ${total === 1 ? "screenshot" : "screenshots"}${
                hasMore ? "+" : ""
              } captured across ${monitored} ${
                monitored === 1 ? "employee" : "employees"
              } on ${dateLabel(date)}. ${
                needsReview > 0
                  ? `${needsReview} ${needsReview === 1 ? "capture needs" : "captures need"} review — start with those.`
                  : notYetChecked > 0
                    ? `Nothing flagged in the ${analysed.toLocaleString()} the AI has checked so far — ${notYetChecked.toLocaleString()} not checked yet.`
                    : "Nothing flagged — the AI has checked every capture."
              }`;

  // Tell the assistant what this page is actually showing.
  //
  // **This is what stops it answering about the wrong day.** Every date-keyed tool on the server
  // defaults to today (UTC); asked "which screenshot needs review" while this page sat on Aug 14,
  // it answered for Aug 15 — "no screenshots were captured today" — which is true and useless. The
  // hero figures travel too, because `needsReview` is computed right here from rows already
  // fetched: it exists in this tab and nowhere else, so a question about it was previously
  // unanswerable and simply got denied.
  useAssistantPageContext({
    date: date || null,
    facts: [
      { label: "Tab", value: "Screenshots" },
      ...(countsUnknown
        ? [
            {
              label: "Status",
              value: error ? "the day's screenshots failed to load" : "still loading",
            },
          ]
        : [
            { label: "Employees captured", value: String(monitored) },
            { label: "Screenshots", value: `${total}${hasMore ? "+" : ""}` },
            { label: "Needs review", value: String(needsReview) },
          ]),
      ...(aiAnalysed
        ? [
            {
              label: "On-task (AI-analysed frames)",
              value: `${aiAnalysed.metrics.on_task_pct}% of ${aiAnalysed.metrics.frames}`,
            },
          ]
        : []),
      ...(dept !== ALL_DEPTS
        ? [{ label: "Department filter", value: deptNames.get(dept) ?? UNKNOWN_DEPARTMENT }]
        : []),
      ...(flag === "flagged"
        ? [{ label: "Filter", value: "showing only captures needing review" }]
        : []),
      ...(query.trim() ? [{ label: "Search", value: query.trim() }] : []),
    ],
  });

  const nameOf = (id: string) => personName(dirById.get(id)?.name, OUT_OF_SCOPE);

  /**
   * Who wrote the card's text: the local count line is ours; the server's narrative says whether a
   * model wrote it (`ai_generated` / `model`, MON-08) — inferred only from a server that predates that.
   */
  const shotProvenance: Provenance = aiAnalysed
    ? screenshotSummaryProvenance(aiAnalysed)
    : countsUnknown
      ? { kind: "none" }
      : { kind: "computed" };

  if (openUser) {
    // **Fetched for this person, from the server** — not filtered out of the gallery's list. The
    // gallery stops paging at a cap, and its sort key is user-then-time, so on a large day whole
    // people fell outside it: their tile vanished and the profile deep link opened "0 captures"
    // (QA audit 2026-10-08, WP-079). The detail view has its own review/time filters too, so it was
    // never meant to inherit the gallery's. Reach is still enforced — server-side, per person.
    const emp = dirById.get(openUser);
    const deptId = emp?.department_id;
    return (
      <EmployeeCapturesLoader
        userId={openUser}
        name={nameOf(openUser)}
        dept={deptId ? deptLabel(deptId) : "—"}
        date={date}
        today={today}
        onDateChange={setDate}
        nameOf={nameOf}
        onBack={() => {
          setOpenUser(null);
          // Leaving a scoped person leaves the scope too, or the other tabs would stay on them — but
          // keeps the day and department (MON-13).
          if (deepLinkedUser) replaceSearch({ [EMP_PARAM]: null });
          // The person's view may have taken new captures; show them in the roster too.
          reloadDay();
        }}
      />
    );
  }

  // The gallery stopped at its paging cap with more of the day unread. Its order is user-then-time,
  // so the people it never reached are whole people, not just older frames — list the active ones
  // (under the same department/search filters) so each can still be opened.
  const capped = hasMore && !loading && !loadingMore && autoPages.current >= MAX_AUTO_PAGES;
  const shown = new Set(groups.map((g) => g.userId));
  const unseen = capped
    ? directory.filter(
        (e) =>
          e.status === "active" &&
          !shown.has(e.user_id) &&
          (dept === ALL_DEPTS || e.department_id === dept) &&
          (!q || (e.name ?? "").toLowerCase().includes(q)),
      )
    : [];
  const unseenPanel =
    unseen.length > 0 ? (
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm text-muted-foreground">
          This day is too large to show everyone above. These people may have captures that
          weren&apos;t loaded here — open one to see their full day.
        </p>
        <div className="flex flex-wrap gap-2">
          {unseen.map((e) => (
            <Button
              key={e.user_id}
              variant="outline"
              size="sm"
              onClick={() => setOpenUser(e.user_id)}
            >
              {personName(e.name, OUT_OF_SCOPE)}
            </Button>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-5" data-tour="shots:review">
      <AiReportCard
        // No "AI" in the title (MON-08): the text below is the local count line until frames are
        // analysed, and after that it may be the model's or the server's own line — the provenance
        // line under it says which.
        title={
          dept === ALL_DEPTS ? "Screenshot summary" : `Screenshot summary · ${deptLabel(dept)}`
        }
        provenance={shotProvenance}
        summary={aiAnalysed?.narrative || summary}
        notice={aiNotice ?? aiCoverage}
        // Only once there is a server narrative: until frames are analysed the card shows our own
        // count line, which no model run can change (MON-08).
        onRegenerate={aiAnalysed ? regenerateAi : undefined}
        regenerating={aiRegenFor === aiSelection}
        metrics={[
          // "—" while the grid loads or after it failed: a count of 0 there is a measurement of
          // nothing (QA audit 2026-10-08, WP-113).
          { label: "Monitored", value: countsUnknown ? "—" : monitored },
          {
            label: "Screenshots",
            value: countsUnknown ? "—" : total.toLocaleString(),
            hint: hasMore ? "so far" : undefined,
          },
          {
            label: "Needs review",
            value: countsUnknown ? "—" : needsReview,
            // Says how much of the day the count covers (MON-01).
            hint: countsUnknown ? undefined : `AI-checked ${analysed.toLocaleString()} of ${total.toLocaleString()}`,
            // The headline figure is the filter (MON-11): pressing it narrows the gallery to those
            // captures, the same as "Show: Needs review" below — and pressing again shows everyone.
            toggle:
              countsUnknown || (needsReview === 0 && flag === "all")
                ? undefined
                : {
                    pressed: flag === "flagged",
                    onToggle: () => setFlag((f) => (f === "flagged" ? "all" : "flagged")),
                    label:
                      flag === "flagged"
                        ? `Needs review: ${needsReview}. Showing only these — press to show every capture`
                        : `Needs review: ${needsReview}. Press to show only these`,
                  },
          },
          {
            label: "On-task",
            value: aiAnalysed ? `${aiAnalysed.metrics.on_task_pct}%` : "—",
            hint: aiAnalysed
              ? `of ${aiAnalysed.metrics.frames.toLocaleString()} analysed`
              : aiSummary
                ? "none analysed yet"
                : undefined,
          },
          // The department's AI screenshot-productivity — the per-department score for this surface.
          // Present only once vision has graded frames for the day/department in view.
          ...(aiSummary?.metrics.avg_productivity != null
            ? [
                {
                  label:
                    dept === ALL_DEPTS ? "Screen productivity" : `${deptLabel(dept)} productivity`,
                  value: `${Math.round(aiSummary.metrics.avg_productivity)}/100`,
                  hint: "AI-graded screenshots",
                },
              ]
            : []),
        ]}
      />

      {/* Filters: day · search · department · review toggle */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="Date" htmlFor="ss-date">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous day"
              disabled={!date}
              onClick={() => date && setDate(shiftIso(date, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <DatePicker
              id="ss-date"
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
              onClick={() => date && date < today && setDate(shiftIso(date, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </Field>

        <Field label="Search" htmlFor="ss-search">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ss-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Employee name…"
              className="h-8 w-56 pl-8"
            />
          </div>
        </Field>

        {departments.length > 0 ? (
          <Field label="Department">
            <DepartmentFilter
              value={dept}
              onChange={setDept}
              options={[...deptNames].map(([id, name]) => ({ value: id, label: name }))}
              ariaLabel="Filter screenshots by department"
            />
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

        {/* Pull the latest captures without a page reload — the grid refetches in place. Lifted into
            the top-navbar action slot so Refresh sits where it does on every other page. */}
        <PageActions>
          <RefreshButton onRefresh={reloadDay} refreshing={loading} />
        </PageActions>
      </div>

      {/* Stated once, plainly, rather than only when someone stumbles onto a deleted day. */}
      {retentionDays !== null ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Trash2 className="size-3.5 shrink-0" />
          Screenshots are deleted automatically {retentionDays} days after capture.
        </p>
      ) : null}

      {filteredShots.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{groups.length}</span>{" "}
          {groups.length === 1 ? "person" : "people"} ·{" "}
          <span className="font-medium text-foreground">{filteredShots.length}</span>{" "}
          {filteredShots.length === 1 ? "screenshot" : "screenshots"}
          {withheld > 0 ? ` · ${withheld} withheld by privacy policy` : ""}
          {hasMore ? " · more available" : ""} · open a person to see their captures.
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <Loader label="Loading screenshots…" />
        </div>
      ) : error ? (
        <EmptyState
          icon={ShieldOff}
          title="Couldn't load screenshots"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={reloadDay}>
              Try again
            </Button>
          }
        />
      ) : shots.length === 0 && beyondRetention ? (
        /* An empty day past the retention window is not the same fact as an empty day inside it.
           "Nothing was reported" invites you to go looking for a capture bug; the frames were
           deleted on purpose, and saying so is the difference between a dead end and an answer. */
        <EmptyState
          icon={Trash2}
          title="Deleted by the retention policy"
          description={`${dateLabel(date)} is older than this organization's ${retentionDays}-day retention window, so any screenshots from that day have been permanently deleted. Pick a more recent date to see captures.`}
        />
      ) : shots.length === 0 ? (
        // Says why — switched off, no agent, agents silent since when, or nothing while they ran —
        // with the page that fixes it (MON-10). It read the same in every one of those cases.
        <CaptureEmptyState date={date} today={today} />
      ) : flag === "flagged" && filteredShots.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nothing waiting for review"
          description={
            notYetChecked > 0
              ? `Nothing flagged in the ${analysed.toLocaleString()} captures the AI has checked so far. ${notYetChecked.toLocaleString()} haven't been checked yet — flags appear here as it gets to them.`
              : "The AI has checked every capture on this day, and nothing needs a look that hasn't had one."
          }
        />
      ) : filteredShots.length === 0 ? (
        unseenPanel ?? (
          <EmptyState
            icon={Users}
            title="No people match"
            description="Try a different name or department."
          />
        )
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
                  userId={g.userId}
                  name={personName(emp?.name, OUT_OF_SCOPE)}
                  dept={deptId ? deptLabel(deptId) : "—"}
                  cover={cover}
                  count={captureCountOf(g.shots)}
                  flaggedCount={g.shots.filter(awaitsReview).length}
                  onOpen={() => setOpenUser(g.userId)}
                  onImageError={onTileImageError}
                />
              );
            })}
          </div>

          {/* No "Load more" here by design — the roster loads the whole day itself (see the
              auto-paging effect), so a button would only ever be a spinner. Paging lives inside a
              person's captures instead. This shows the roster is still filling, and is the one place
              the automatic cap becomes visible if a day ever exceeds it. */}
          {loadingMore ? (
            <p className="pt-1 text-center text-sm text-muted-foreground">
              Loading the rest of the day…
            </p>
          ) : null}
          {unseenPanel}
        </>
      )}

      {/* No full-screen viewer at this level — a tile opens the person, and their view has one. */}
    </div>
  );
}

/**
 * Employee tile — the preview's gallery card: a cover screenshot (the latest capture) with the real
 * app label and capture time, over the person's name + department + avatar (initials fallback, no
 * uploaded picture on the lean roster), and a badge with the person's flags awaiting review. A
 * withheld cover shows the privacy placeholder rather than an image.
 *
 * A real button for the keyboard: this tile is the only way into a person's captures, and as a
 * click-only `<div>` it could not be reached or opened without a mouse (QA audit 2026-10-08, WP-489).
 *
 * The badge says "3 to review" in words, and the tile's accessible name says it too (UX audit
 * 2026-10-16, MON-11): it was a bare red "3" that a screen reader never heard and a sighted reader
 * had to guess at. `count` is capture **moments**, not monitor frames (MON-12).
 */
function EmployeeCard({
  userId,
  name,
  dept,
  cover,
  count,
  flaggedCount,
  onOpen,
  onImageError,
}: {
  /** Whose shots these are — so the card shows their photo, not just initials. */
  userId: string;
  name: string;
  dept: string;
  cover: ShotRow;
  count: number;
  flaggedCount: number;
  onOpen: () => void;
  /** The cover image failed to load — its presigned URL may have expired. */
  onImageError?: () => void;
}) {
  const withheld = cover.redacted || !cover.url;
  const captures = `${count} ${count === 1 ? "capture" : "captures"}`;
  const review = flaggedCount > 0 ? `, ${flaggedCount} to review` : "";
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}'s captures — ${captures}${review}`}
      className="group cursor-pointer gap-0 overflow-hidden p-0 transition hover:ring-1 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
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
          <ShotImage
            src={cover.url}
            alt={`${name} — ${cover.app}`}
            lazy
            className="size-full max-w-full object-cover transition group-hover:scale-[1.02]"
            onError={onImageError}
          />
        )}
        <div className="absolute left-2 top-2 max-w-[70%] truncate rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {cover.app || "Unknown app"}
        </div>
        {flaggedCount > 0 ? (
          // Amber ink on the page surface, not white on red: 11 px white on the red token is 3.7:1.
          <Badge className="absolute right-2 top-2 gap-1 border-transparent bg-background/95 font-semibold text-warning shadow-sm ring-1 ring-warning/50">
            <Flag className="size-3" aria-hidden="true" />
            {flaggedCount} to review
          </Badge>
        ) : withheld ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-muted text-muted-foreground shadow-sm">
            Redacted
          </Badge>
        ) : null}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {captures}
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur-sm">
          {formatTime(cover.captured_at)}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <UserAvatar
          userId={userId}
          name={name}
          className="size-9"
          fallbackClassName="text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{dept}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}

/**
 * A labelled filter control. Pass `htmlFor` (the control's `id`) so the caption is a real `<label>`
 * a screen reader announces with the control; a bare caption was an unassociated `<span>`.
 */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const caption = "text-xs font-medium text-muted-foreground";
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={caption}>
          {label}
        </label>
      ) : (
        <span className={caption}>{label}</span>
      )}
      {children}
    </div>
  );
}

/**
 * Fullscreen viewer — the image fills its own letterboxed pane, metadata sits in a distinct section
 * below, and the per-frame AI read (`ShotAiReport`) hangs under the metadata. Withheld shots show the
 * privacy placeholder in the pane rather than an image (and no AI read — a withheld frame never
 * reached the model).
 *
 * **It walks the whole filtered day** (UX audit 2026-10-16, MON-12). It used to walk only the tiles
 * on screen, so the arrows stopped after the first 60 captures, and its counter counted monitor
 * frames ("7 / 120" on a day of 60 two-monitor captures). Now:
 *  - ←/→ (and the side buttons) step frame by frame through every capture that matches the filters,
 *    each capture's monitors in turn; Home/End jump to the first and last; a horizontal swipe steps
 *    on a touch screen;
 *  - "Previous flagged" / "Next flagged" jump between captures still awaiting review;
 *  - nearing the end of what has loaded asks the server for the next page (`onLoadMore`), so the walk
 *    doesn't stop at the loader's automatic budget;
 *  - the counter counts **captures** — "Capture 12 of 340 · monitor 1 of 2".
 */
function Lightbox({
  captures,
  index,
  date,
  nameOf,
  onIndexChange,
  onClose,
  onImageError,
  onReviewed,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  /** The filtered captures, newest first — the same list the grid shows. */
  captures: Capture[];
  /** Index into the captures' frames, flattened (each capture's monitors in turn). */
  index: number | null;
  /** The day being reviewed — needed to fetch/generate the per-frame AI report. */
  date: string;
  nameOf: (id: string) => string;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** The frame failed to load — its presigned URL may have expired. */
  onImageError?: () => void;
  /** A reviewer confirmed or dismissed this frame's flag — the caller updates its counts. */
  onReviewed?: (shotId: string, outcome: "confirmed" | "dismissed") => void;
  /** The server has more of the day than has loaded. */
  hasMore?: boolean;
  loadingMore?: boolean;
  /** Fetch the next page of the day. */
  onLoadMore?: () => void;
}) {
  const shots = useMemo(() => captures.flatMap((c) => c.monitors), [captures]);
  const positions = useMemo(() => framePositions(captures), [captures]);
  const count = shots.length;
  const shot = index !== null ? (shots[index] ?? null) : null;
  const pos = index !== null ? (positions[index] ?? null) : null;
  const open = shot !== null;

  /** The first frame of capture `ci` — its cover (the flagged monitor) when `cover` is set. */
  const frameOf = useCallback(
    (ci: number, cover = false) => {
      const first = positions.findIndex((p) => p.capture === ci);
      if (first < 0 || !cover) return first;
      const c = captures[ci];
      const offset = Math.max(0, c.monitors.indexOf(c.cover));
      return first + offset;
    },
    [positions, captures],
  );

  const prevFlagged = pos ? nextFlaggedIndex(captures, pos.capture, -1) : null;
  const nextFlagged = pos ? nextFlaggedIndex(captures, pos.capture, 1) : null;
  const anyFlagged = captures.some((c) => c.awaitsReview);

  // Load the next page as the walk nears the end of what has loaded, not only at the very end.
  useEffect(() => {
    if (!open || index === null || !hasMore || loadingMore || !onLoadMore) return;
    if (index >= count - 3) onLoadMore();
  }, [open, index, count, hasMore, loadingMore, onLoadMore]);

  useEffect(() => {
    if (!open || index === null) return;
    const onKey = (e: KeyboardEvent) => {
      // Never steal keys from a field — the flag note box takes text, and arrows/Home/End must keep
      // moving the caret there.
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))
        return;
      if (e.key === "ArrowRight" && index < count - 1) {
        e.preventDefault(); // also stops the arrow scrolling the dialog behind the image
        onIndexChange(index + 1);
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        onIndexChange(index - 1);
      } else if (e.key === "Home" && index > 0) {
        e.preventDefault();
        onIndexChange(0);
      } else if (e.key === "End" && index < count - 1) {
        e.preventDefault();
        onIndexChange(count - 1);
      }
    };
    // **Capture phase, deliberately.** This viewer is a Base UI `Dialog`, which traps focus and
    // handles keys on the popup itself. A bubble-phase listener on `window` is last in line and only
    // runs if nothing between the focused element and the window stopped propagation — which is why
    // the arrows did nothing. Capturing runs on the way *down*, before any of that, so they work
    // wherever focus happens to sit inside the dialog.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, index, count, onIndexChange]);

  // A horizontal swipe on a touch screen steps like the arrows. Pointer events, so a mouse drag
  // (selecting, or dragging the image) never pages.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || index === null) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && index < count - 1) onIndexChange(index + 1);
    else if (dx > 0 && index > 0) onIndexChange(index - 1);
  };

  const atStart = index === 0;
  const atEnd = index !== null && index === count - 1;
  const withheld = shot ? shot.redacted || !shot.url : false;
  // How many monitors this one moment was photographed on — frames of a capture share `captured_at`.
  const monitorsInCapture = pos?.monitors ?? 0;
  const navButton =
    "inline-flex h-8 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 ring-0 sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Screenshot viewer</DialogTitle>
          <DialogDescription>
            {shot ? `${shot.app || "Unknown app"} — ${nameOf(shot.user_id)}. ` : ""}
            The left and right arrow keys step through the captures; Home and End jump to the first
            and the last.
          </DialogDescription>
        </DialogHeader>

        {shot && pos ? (
          <>
            {/* Image pane */}
            <div
              className="group relative flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden bg-black"
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                swipe.current = null;
              }}
            >
              {withheld ? (
                <div className="flex flex-col items-center gap-3 text-center text-white/75">
                  <EyeOff className="size-8" />
                  <p className="text-sm font-medium">Withheld by privacy policy</p>
                </div>
              ) : (
                <ShotImage
                  key={shot.shot_id}
                  src={shot.url}
                  alt={`${shot.app} screenshot`}
                  className="max-h-full max-w-full object-contain"
                  onError={onImageError}
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

              {/* Where you are, in captures (not frames), and the jumps between flags. */}
              <div className="absolute inset-x-0 bottom-3 z-10 flex flex-wrap items-center justify-center gap-2 px-3">
                {anyFlagged ? (
                  <button
                    type="button"
                    className={navButton}
                    disabled={prevFlagged === null}
                    onClick={() => prevFlagged !== null && onIndexChange(frameOf(prevFlagged, true))}
                  >
                    <ChevronsLeft className="size-3.5" aria-hidden="true" /> Previous flagged
                  </button>
                ) : null}
                <span
                  className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium tabular-nums text-white/90 backdrop-blur-sm"
                  aria-live="polite"
                >
                  {counterLabel(pos, captures.length, hasMore)}
                  {loadingMore && atEnd ? " · loading more…" : ""}
                </span>
                {anyFlagged ? (
                  <button
                    type="button"
                    className={navButton}
                    disabled={nextFlagged === null}
                    onClick={() => nextFlagged !== null && onIndexChange(frameOf(nextFlagged, true))}
                  >
                    Next flagged <ChevronsRight className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Metadata section */}
            <div className="shrink-0 border-t border-white/10 bg-[#0d0e13]">
              <dl className="mx-auto flex w-full max-w-7xl flex-wrap items-start gap-x-10 gap-y-4 px-6 py-5 sm:px-8">
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
                    className="text-red-300"
                  />
                ) : null}
              </dl>
              {/* The vision model's read of this frame. A withheld frame was never sent to the model,
                  so there's nothing to show. */}
              {!withheld ? (
                <div className="mx-auto w-full max-w-7xl border-t border-white/10 px-6 py-4 sm:px-8">
                  <ShotAiReport
                    key={`${shot.user_id}:${shot.shot_id}`}
                    shotId={shot.shot_id}
                    userId={shot.user_id}
                    date={date}
                    rowFlagged={shot.flagged}
                    humanReview={shot.human_review}
                  />
                  {/* A flag a person can act on — the queue shrinks as flags are handled (MON-02). */}
                  {shot.flagged ? (
                    <FlagReview
                      key={`review:${shot.shot_id}`}
                      shot={shot}
                      onReviewed={(outcome) => onReviewed?.(shot.shot_id, outcome)}
                    />
                  ) : null}
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
      {/* White at 65% on the panel is 8.4:1 — at 45% the labels sat on the 4.5:1 line (MON-14). */}
      <dt className="text-[11px] font-medium uppercase tracking-wide text-white/65">{label}</dt>
      <dd className={cn("mt-1 break-words font-medium text-white", className)}>{value}</dd>
    </div>
  );
}

/**
 * The vision model's read of one screenshot (`vision_map`), fetched on demand when the frame opens.
 *
 * Frames are graded as they arrive (the `insights-vision` stream worker, with an hourly catch-up), so
 * a just-captured frame legitimately has no report yet — that's a 404, surfaced as "not analyzed",
 * not an error. Running it now (`POST /v1/insights/screenshots/reports`) spends the org's AI budget
 * and needs **Manage Monitoring Settings** (`monitoring:manage`, server `MonitoringManage`), so the
 * Generate button is offered only to a role that holds it (UX audit 2026-10-16, MON-14); anyone else
 * is told the analysis runs on its own and who can run it sooner. The server still enforces it.
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
  rowFlagged,
  humanReview,
}: {
  shotId: string;
  userId: string;
  date: string;
  /** The grid's flag — the confidence-filtered one the counts use, so the panel agrees with them. */
  rowFlagged: boolean;
  humanReview?: "confirmed" | "dismissed";
}) {
  const [state, setState] = useState<AiState>({ kind: "loading" });
  const [running, setRunning] = useState(false);
  const canRun = usePermissions().can("monitoring:manage");

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
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/65">
        <Sparkles className="size-3.5" aria-hidden="true" /> AI read
      </div>

      {state.kind === "loading" && (
        <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" /> Loading the AI read…
        </p>
      )}

      {state.kind === "loaded" && (
        <AiReadBody report={state.report} rowFlagged={rowFlagged} humanReview={humanReview} />
      )}

      {state.kind === "none" && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/75">
            This frame hasn&apos;t been analyzed yet.
            {canRun
              ? ""
              : " Analysis normally runs on its own, usually within the hour. Someone with the Manage Monitoring Settings permission can run it now."}
          </p>
          {canRun ? (
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
          ) : null}
        </div>
      )}

      {/* Light red on the always-dark panel: the page's red ink is darkened for light surfaces. */}
      {state.kind === "error" && <p className="mt-2 text-sm text-red-300">{state.message}</p>}
    </div>
  );
}

/**
 * The rendered report — what is on screen, whether it serves the person's role, category /
 * work-related / flag badges, and provenance.
 */
function AiReadBody({
  report,
  rowFlagged,
  humanReview,
}: {
  report: ScreenshotReport;
  /**
   * The flag the grid counts. The report keeps the model's raw flag, below the confidence bar too,
   * so the panel said "Needs review" for frames the counts left out; it follows the grid now.
   */
  rowFlagged: boolean;
  humanReview?: "confirmed" | "dismissed";
}) {
  // One neutral chip whatever the category — the word carries it. It was a red/green pair, which
  // colour-blind readers can't tell apart, in page inks too dark for this panel (MON-14 / MON-16).
  const generated = formatGeneratedAt(report.generated_at);
  const confidence = report.confidence > 0 ? Math.round(report.confidence * 100) : null;
  return (
    <div className="mt-2 space-y-2">
      <p className="max-w-3xl text-sm leading-relaxed text-white/90">{report.description}</p>
      {/* The role-specific read — does this serve the person's department and job title, and why
          (owner decision 2026-10-13). Absent on reports written before then. */}
      {report.assessment ? (
        <p className="max-w-3xl text-[13px] leading-relaxed text-white/75">{report.assessment}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-medium capitalize text-white/90">
          {report.category}
        </span>
        <span className="rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/90">
          {report.work_related ? "Work-related" : "Not work-related"}
        </span>
        {rowFlagged && !humanReview ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-amber-300/20 px-2 py-0.5 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/40">
            <Flag className="size-3" aria-hidden="true" /> Needs review
          </span>
        ) : rowFlagged && humanReview ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/90">
            <Flag className="size-3" aria-hidden="true" /> {humanReview === "confirmed" ? "Flag confirmed" : "Flag dismissed"}
          </span>
        ) : null}
      </div>
      {rowFlagged && report.flag_reason ? (
        <p className="text-[13px] text-amber-100">
          <span className="font-medium">Why it was flagged:</span> {report.flag_reason}
        </p>
      ) : null}
      {/* Who wrote it and when, at a readable contrast — the line was white at 35% (3.2:1) and
          named neither the model nor the time (MON-14). */}
      <p className="text-xs text-white/75">
        {["AI analysis", report.model?.trim() || null, generated ? `analyzed ${generated}` : null]
          .filter(Boolean)
          .join(" · ")}
        {confidence !== null ? ` · ${confidence}% confidence` : ""}
      </p>
      <p className="max-w-3xl text-xs text-white/75">
        {confidence !== null
          ? "Confidence is how sure the model said it was — not a check that it's right. The AI can be wrong, so a person makes the call."
          : "The AI can be wrong, so a person makes the call."}
      </p>
    </div>
  );
}

/**
 * Confirm or dismiss an AI flag, with an optional note (UX audit 2026-10-16, MON-02). Stored on the
 * frame and audited under the reviewer's name; "Needs review" counts drop as flags are handled. A
 * decision can be changed — pressing the other button replaces it.
 */
function FlagReview({
  shot,
  onReviewed,
}: {
  shot: ShotRow;
  onReviewed: (outcome: "confirmed" | "dismissed") => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"confirmed" | "dismissed" | null>(null);
  const done = shot.human_review;

  async function decide(outcome: "confirmed" | "dismissed") {
    setBusy(outcome);
    try {
      await reviewScreenshot(shot, outcome, note);
      onReviewed(outcome);
      setNote("");
      toast.success(outcome === "dismissed" ? "Flag dismissed" : "Flag confirmed", {
        description: "Recorded in the audit log under your name.",
      });
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.code === "not_flagged"
          ? "This screenshot isn't flagged any more."
          : friendlyError(e, "Couldn't save your review."),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
      <p className="text-sm font-medium text-white/90">
        {done === "confirmed"
          ? "You've confirmed this flag — it needs following up."
          : done === "dismissed"
            ? "This flag was dismissed — it was fine."
            : "Is the AI right to flag this?"}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        aria-label="Note about this flag (optional)"
        placeholder="Note (optional) — what you checked or decided"
        className="w-full resize-none rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 focus:ring-2 focus:ring-white/30 focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={busy !== null || done === "confirmed"}
          onClick={() => void decide("confirmed")}
        >
          {busy === "confirmed" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
          Confirm flag
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null || done === "dismissed"}
          onClick={() => void decide("dismissed")}
        >
          {busy === "dismissed" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          Dismiss — it&apos;s fine
        </Button>
      </div>
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
  /** A flag on this capture that no reviewer has handled yet (MON-02). */
  awaitsReview: boolean;
  /** The reviewer's decision on the flagged frame, once there is one. */
  humanReview?: "confirmed" | "dismissed";
  /** `true` when the vision model has judged every monitor in this capture. */
  reviewed: boolean;
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
        awaitsReview: monitors.some(awaitsReview),
        humanReview: monitors.find((s) => s.flagged)?.human_review,
        // Reviewed only when *every* frame of the moment has been analysed — a capture with one
        // judged monitor and one un-judged one has not been fully reviewed, and claiming otherwise
        // is the same over-statement this field exists to stop.
        reviewed: monitors.every((s) => s.reviewed === true),
        // Lead with the frame that earned the flag — a reviewer should see *why* it is flagged
        // without first clicking past whichever monitor happens to be primary.
        cover: monitors.find((s) => s.flagged) ?? monitors[0],
      };
    });
}

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Minutes past local midnight — for comparing a capture with the From/To pickers. The pickers give
 * 24-hour `"HH:MM"`; comparing that with a locale time string was wrong for every PM time in a
 * 12-hour locale (`"02:15 pm" < "13:00"`), so afternoons vanished from the range (WP-083).
 */
const minutesOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

/** `"HH:MM"` (24-hour, as the time picker gives it) → minutes past midnight; `null` if unparseable. */
const pickerMinutes = (v: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * One person's day for the detail view, read from the server **for that person** (GSI4 user
 * prefix), auto-paged to a bound — so it is complete whether or not the gallery reached them.
 */
function EmployeeCapturesLoader({
  userId,
  name,
  dept,
  date,
  today,
  onDateChange,
  nameOf,
  onBack,
}: {
  userId: string;
  name: string;
  dept: string;
  date: string;
  today: string;
  onDateChange: (iso: string) => void;
  nameOf: (id: string) => string;
  onBack: () => void;
}) {
  const {
    shots: read,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    reload,
    loadedAt,
  } = useScreenshots(date, userId);
  // Decisions made here, laid over the last read so "Needs review" drops at once (MON-02). The next
  // read carries them from the server anyway.
  const [decided, setDecided] = useState<Record<string, "confirmed" | "dismissed">>({});
  const shots = useMemo(
    () =>
      read.map((s) => (decided[s.shot_id] ? { ...s, human_review: decided[s.shot_id] } : s)),
    [read, decided],
  );
  const pages = useRef(0);
  useEffect(() => {
    pages.current = 0;
  }, [date, userId]);
  // Capture-now polls this every few seconds while it waits for the frame: only this person's day
  // is refetched (not the whole org's), and each refetch gets a fresh paging budget.
  const reloadMine = useCallback(() => {
    pages.current = 0;
    reload();
  }, [reload]);
  const onImageError = useExpiredUrlRefresh(loadedAt, reloadMine);
  useEffect(() => {
    if (!hasMore || loading || loadingMore || error) return;
    if (pages.current >= MAX_USER_PAGES) return;
    pages.current += 1;
    loadMore();
  }, [hasMore, loading, loadingMore, error, loadMore]);
  return (
    <EmployeeCaptures
      userId={userId}
      name={name}
      dept={dept}
      device={shots.find((s) => s.device)?.device ?? ""}
      shots={shots}
      date={date}
      today={today}
      onDateChange={onDateChange}
      nameOf={nameOf}
      onBack={onBack}
      onCaptured={reloadMine}
      onRefresh={reloadMine}
      refreshing={loading}
      loadingMore={loadingMore}
      error={error}
      onImageError={onImageError}
      onReviewed={(shotId, outcome) => setDecided((d) => ({ ...d, [shotId]: outcome }))}
      // Past the automatic budget the viewer and the grid can still ask for the next page (MON-12).
      hasMore={hasMore}
      onLoadMore={loadMore}
    />
  );
}

/**
 * One employee's captures for the selected day — the level that was missing.
 *
 * The gallery used to open the full-screen viewer straight from an employee tile, skipping this
 * entirely: there was no way to see what an employee's day looked like, or to find the flagged
 * frames within it, without paging a carousel one frame at a time.
 *
 * Day-scoped (owner decision, 2026-07-22), matching how the capture index is partitioned — one
 * partition per tenant-day. The day is the page's, with its own stepper here, so a profile's deep
 * link is not stuck on today.
 */
function EmployeeCaptures({
  userId,
  name,
  dept,
  device,
  shots,
  date,
  today,
  onDateChange,
  nameOf,
  onBack,
  onCaptured,
  onRefresh,
  refreshing,
  loadingMore = false,
  error = null,
  onImageError,
  onReviewed,
  hasMore = false,
  onLoadMore,
}: {
  /** Whose captures these are — the target for an on-demand capture (device resolved from it). */
  userId: string;
  name: string;
  dept: string;
  device: string;
  shots: ShotRow[];
  date: string;
  today: string;
  onDateChange: (iso: string) => void;
  nameOf: (id: string) => string;
  onBack: () => void;
  /** Refetch the day's grid once the device confirms a capture landed. */
  onCaptured: () => void;
  /** Manual refetch of this person's day — refreshes the grid in place instead of a page reload. */
  onRefresh: () => void;
  /** True while that refetch is in flight, so the button can spin. */
  refreshing?: boolean;
  /** More of the day is still arriving in the background. */
  loadingMore?: boolean;
  /** The day's read failed — never shown as "no captures". */
  error?: string | null;
  /** An image failed to load — its presigned URL may have expired. */
  onImageError?: () => void;
  /** A flag was confirmed or dismissed in the viewer (MON-02). */
  onReviewed?: (shotId: string, outcome: "confirmed" | "dismissed") => void;
  /** The server has more of this person's day than has loaded. */
  hasMore?: boolean;
  /** Fetch the next page of it. */
  onLoadMore?: () => void;
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
        const t = minutesOfDay(c.capturedAt);
        const lo = from ? pickerMinutes(from) : null;
        const hi = to ? pickerMinutes(to) : null;
        if (lo !== null && t < lo) return false;
        if (hi !== null && t > hi) return false;
        if (flag === "flagged" && !c.awaitsReview) return false;
        return true;
      }),
    [allCaptures, from, to, flag],
  );

  /**
   * Reveal this person's captures a page at a time.
   *
   * The day is read in the background by `EmployeeCapturesLoader`, so this is a render budget over
   * what has arrived, not a fetch. It exists because a long day is hundreds of images, and mounting
   * them all at once costs a visibly slow open for frames nobody has scrolled to. Resets whenever the
   * filters change which captures qualify, so a narrowed range never starts part-way down a list it
   * no longer describes.
   */
  const [visible, setVisible] = useState(DETAIL_PAGE);
  useEffect(() => setVisible(DETAIL_PAGE), [from, to, flag, userId]);
  const shown = useMemo(() => captures.slice(0, visible), [captures, visible]);

  // The viewer walks every monitor of **every capture that matches the filters**, in grid order
  // (newest first) — not only the tiles on screen, where it stopped after the first 60 (MON-12).
  const firstIndexOfCapture = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const c of captures) {
      m.set(c.key, i);
      i += c.monitors.length;
    }
    return m;
  }, [captures]);
  // Walking past the tiles on screen reveals them, so closing the viewer lands where it left off.
  const positions = useMemo(() => framePositions(captures), [captures]);
  useEffect(() => {
    if (viewerIdx === null) return;
    const ci = positions[viewerIdx]?.capture;
    if (ci !== undefined && ci >= visible) {
      setVisible(Math.ceil((ci + 1) / DETAIL_PAGE) * DETAIL_PAGE);
    }
  }, [viewerIdx, positions, visible]);

  const monitorCount = useMemo(
    () => new Set(shots.map((s) => s.display ?? 0)).size,
    [shots],
  );
  const flaggedCount = allCaptures.filter((c) => c.awaitsReview).length;
  const uncheckedCount = allCaptures.filter((c) => !c.reviewed).length;
  const dirty = from !== "" || to !== "" || flag !== "all";
  /** Nothing read yet (first page in flight) or the read failed — the counts would be a false 0. */
  const unread = shots.length === 0 && (Boolean(refreshing) || error !== null);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ChevronLeft className="size-4" /> All employees
      </Button>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-soft">
        <UserAvatar
          userId={userId}
          name={name}
          className="size-11"
          fallbackClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {dept}
            {device ? " · " + device : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <Summary label="Captures" value={unread ? "—" : allCaptures.length} />
          <Summary label="Monitors" value={unread ? "—" : monitorCount} />
          <Summary
            label="Needs review"
            value={unread ? "—" : flaggedCount}
            tone={flaggedCount > 0 ? "text-destructive" : undefined}
          />
          {/* Pull this person's latest frames without reloading the page — the grid refetches in
              place while the header and filters stay put. */}
          <RefreshButton onRefresh={onRefresh} refreshing={refreshing} />
          {/* On-demand capture belongs here rather than only on the device page: this is where
              someone is already looking at a person's frames and wants a current one. The device
              is resolved from the user inside the button. */}
          <CaptureNowButton
            userId={userId}
            onCaptured={onCaptured}
            hasShot={(id) => allCaptures.some((c) => c.monitors.some((m) => m.shot_id === id))}
          />
        </div>
      </div>

      {/* Filters — the day, then within it */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="Date" htmlFor="ss-emp-date">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous day"
              disabled={!date}
              onClick={() => date && onDateChange(shiftIso(date, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <DatePicker
              id="ss-emp-date"
              value={date}
              max={today}
              onChange={(v) => v && onDateChange(v)}
              className="w-36"
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next day"
              disabled={!date || date >= today}
              onClick={() => date && date < today && onDateChange(shiftIso(date, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </Field>
        <Field label="From" htmlFor="ss-emp-from">
          <TimePicker id="ss-emp-from" value={from} onChange={setFrom} className="w-32" />
        </Field>
        <Field label="To" htmlFor="ss-emp-to">
          <TimePicker id="ss-emp-to" value={to} onChange={setTo} className="w-32" />
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
        {/* Pushed to the row's right edge rather than sitting immediately after the radios, where
            the `gap-x-6` left it stranded mid-bar looking like a stray label. Right-aligned is
            where a filter reset belongs, and it means the control appearing and disappearing with
            `dirty` no longer nudges anything else on the row. */}
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-muted-foreground hover:text-foreground"
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

      {unread ? null : (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{captures.length}</span>{" "}
          {captures.length === 1 ? "capture" : "captures"}
          {monitorCount > 1 ? " · " + monitorCount + " monitors" : ""} on{" "}
          {dateLabel(date)}
          {captures.length > 0 ? " · select one to view it full screen." : "."}
        </p>
      )}

      {/* Loading and failure come first. This view used to render before — and regardless of — its
          read, so a profile deep link opened on "0 captures … Try widening the time range" with no
          filter set, and a failed read kept saying it (QA audit 2026-10-08, WP-293). */}
      {refreshing && shots.length === 0 ? (
        <div className="flex min-h-[16rem] items-center justify-center">
          <Loader label={`Loading ${name}'s captures…`} />
        </div>
      ) : error && shots.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="Couldn't load these captures"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Try again
            </Button>
          }
        />
      ) : captures.length === 0 && !dirty && shots.length === 0 ? (
        // A whole empty day says why, with its fix — their agent missing, silent since when,
        // switched off (MON-10).
        <CaptureEmptyState date={date} today={today} userId={userId} name={name} />
      ) : captures.length === 0 ? (
        <EmptyState
          icon={flag === "flagged" ? Flag : Users}
          title={flag === "flagged" ? "Nothing waiting for review" : "No captures in this range"}
          description={
            flag === "flagged"
              ? uncheckedCount > 0
                ? `Nothing flagged so far — ${uncheckedCount} of this employee's captures haven't been checked by the AI yet.`
                : "The AI has checked all of this employee's captures on this day, and nothing is waiting for review."
              : "Try widening the time range."
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((c) => (
              <CaptureCard
                key={c.key}
                capture={c}
                monitorCount={monitorCount}
                onOpen={() => setViewerIdx(firstIndexOfCapture.get(c.key) ?? 0)}
                onImageError={onImageError}
              />
            ))}
          </div>

          {shown.length < captures.length ? (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <Button
                variant="outline"
                onClick={() => setVisible((v) => v + DETAIL_PAGE)}
              >
                Load more
              </Button>
              <p className="text-xs text-muted-foreground">
                Showing {shown.length} of {captures.length}
                {hasMore ? "+" : ""} captures
              </p>
            </div>
          ) : hasMore && !loadingMore && onLoadMore ? (
            // Past the automatic paging budget — a very long day. The rest is one press away rather
            // than silently missing (MON-12).
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <Button variant="outline" onClick={onLoadMore}>
                Load more from this day
              </Button>
              <p className="text-xs text-muted-foreground">
                {captures.length} captures loaded — this day has more.
              </p>
            </div>
          ) : null}
        </>
      )}

      {loadingMore ? (
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Loading the rest of the day…
        </p>
      ) : error && shots.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-sm text-muted-foreground">
          <AlertTriangle className="size-4 text-warning" />
          Some of this day&apos;s captures couldn&apos;t be loaded.
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}

      <Lightbox
        captures={captures}
        index={viewerIdx}
        date={date}
        nameOf={nameOf}
        onIndexChange={setViewerIdx}
        onClose={() => setViewerIdx(null)}
        onImageError={onImageError}
        onReviewed={onReviewed}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
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
  onImageError,
}: {
  capture: Capture;
  monitorCount: number;
  onOpen: () => void;
  onImageError?: () => void;
}) {
  const shot = capture.cover;
  const withheld = shot.redacted || !shot.url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group overflow-hidden rounded-2xl bg-card text-left shadow-soft transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        capture.awaitsReview && "ring-2 ring-warning/60",
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {withheld ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ShieldOff className="size-6" />
          </div>
        ) : (
          <ShotImage
            src={shot.url}
            alt={shot.app + " at " + hhmm(capture.capturedAt)}
            className="size-full object-cover"
            lazy
            onError={onImageError}
          />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {shot.app || "—"}
        </span>
        {/*
          Only the AI flags a capture: the vision model looked at the frame and judged it not work for
          this person's role (owner decision 2026-10-13). There used to be a second, amber
          "Distracting app" badge on frames nobody had analysed, raised by the app name alone — the
          same app can be core work for one department and a distraction for another, so the name
          decides nothing. An unanalysed frame carries no badge; its detail panel says so.
        */}
        {capture.awaitsReview ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background/95 px-1.5 py-0.5 text-[11px] font-semibold text-warning ring-1 ring-warning/50">
            <Flag className="size-3" aria-hidden="true" /> Needs review
          </span>
        ) : capture.humanReview ? (
          // Handled by a reviewer (MON-02) — still marked, no longer asking.
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Flag className="size-3" />
            {capture.humanReview === "confirmed" ? "Flag confirmed" : "Flag dismissed"}
          </span>
        ) : !capture.reviewed ? (
          // Not looked at yet — so no badge must not read as "clean" (MON-01).
          <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white/85">
            Not checked yet
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
