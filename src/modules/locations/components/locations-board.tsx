"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DepartmentFilter } from "@/components/shared/department-filter";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPinOff,
  Navigation,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { AiReportCard } from "@/modules/insights/components/ai-report-card";
import { canRegenerate, type Provenance } from "@/modules/insights/lib/ai-provenance";
import { countOf, nounFor } from "@/modules/insights/lib/plural";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import { useEmployeeName } from "@/modules/insights/components/employee-scope-bar";
import { ApiError } from "@/lib/api";
import {
  getLocationSummary,
  getOversightLocations,
  regenerateLocationSummary,
  type OversightPersonLocation,
} from "@/modules/insights/services/insights.service";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { useDataScope } from "@/hooks/use-data-scope";
import { LIVE_REFRESH_MS, useLiveRefresh } from "@/hooks/use-live-refresh";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { useGeofenceStore } from "@/stores/geofence.store";
import { formatDate, UNKNOWN_DEPARTMENT } from "@/lib/format";
import {
  deriveMode,
  deriveStatus,
  perimeterVerdict,
  WORK_MODE_LABEL,
  type GeoPoint,
  type WorkMode,
} from "@/modules/locations/types";
import { cn } from "@/lib/utils";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
import { LiveMap, type MapMarker } from "./live-map";
import { replaceSearch, useInsightsDate, useInsightsDept } from "@/modules/insights/use-insights-params";
import { EMP_PARAM } from "@/modules/insights/lib/employee-scope";
import { EmployeeLocationView } from "./employee-location";
import { UserAvatar } from "@/components/shared/user-avatar";

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
/** The one date notation (UX audit XC-06 / MON-23), TZ-safe; `""` for an unset day. */
function dateLabel(iso: string): string {
  return iso ? formatDate(iso) : "";
}
/** Backend points are `{ lat, lon }`; the map wants `{ lat, lng }`. */
const toGeoPoint = (p: { lat: number; lon: number }): GeoPoint => ({
  lat: p.lat,
  lng: p.lon,
});

/**
 * Board ⇄ per-employee detail, mirroring the Screenshots drill-down.
 *
 * The **date is owned here**, not inside either child, so drilling into an employee keeps the day
 * the admin was looking at and coming back preserves it. Holding it in the board instead would reset
 * the detail view to today on every open — the wrong default when someone is investigating a
 * specific past day.
 */
export function LocationsView() {
  const [selected, setSelected] = useState<OversightPersonLocation | null>(null);
  // The day lives in the URL, shared with every Analytics tab, so switching tabs keeps it
  // (UX audit 2026-10-16, MON-13). Today when absent, resolved after mount.
  const [date, setDate] = useInsightsDate();
  // `?emp=<user_id>` — the Analytics hub scoped to one employee (the profile's Analytics button).
  // Read in a Suspense-wrapped child so the page itself never bails out of static rendering over a
  // query string.
  const [deepLink, setDeepLink] = useState<string | null>(null);
  /** The scoped person had no location row for the day, so there was no one to open. */
  const [missing, setMissing] = useState(false);
  // Dropping the scope ("Whole organization" in the scope bar) closes the person it opened.
  useEffect(() => {
    if (!deepLink) setSelected(null);
    setMissing(false);
  }, [deepLink]);
  const scopedName = useEmployeeName(deepLink);

  return (
    <>
      <Suspense fallback={null}>
        <EmpParam onChange={setDeepLink} />
      </Suspense>
      {selected ? (
        <EmployeeLocationView
          person={selected}
          date={date}
          onDateChange={setDate}
          onBack={() => {
            setSelected(null);
            // Leaving a scoped person leaves the scope: the board would otherwise re-read the deep
            // link on remount and open the same person again, so Back never left them. The day and
            // department stay (MON-13).
            if (deepLink) replaceSearch({ [EMP_PARAM]: null });
          }}
        />
      ) : (
        <>
          {deepLink && missing ? (
            <p role="status" className="mb-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {scopedName ?? "This employee"} has no location data for this day — location is recorded only
              while their timer runs, and only where the device allows it. Pick another day, or browse
              everyone below.
            </p>
          ) : null}
          <LocationsBoard
            onSelect={setSelected}
            date={date}
            onDateChange={setDate}
            deepLink={deepLink}
            onDeepLinkMissing={() => setMissing(true)}
          />
        </>
      )}
    </>
  );
}

/** Reports the `?emp=` query parameter. */
function EmpParam({ onChange }: { onChange: (id: string | null) => void }) {
  const id = useSearchParams().get("emp");
  useEffect(() => onChange(id), [id, onChange]);
  return null;
}

/**
 * `online`/`offline` are derived from fix recency, `untracked` from having no fixes at all, and
 * `outside` from the perimeter — see `types.ts` for each definition. They are listed separately
 * because they answer different questions: "is she being tracked right now" vs "did we ever hear
 * from her today" vs "is she where she should be".
 */
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All status",
  online: "Online",
  offline: "Offline",
  untracked: "Untracked",
  located: "Located",
  "no-location": "No location",
  outside: "Outside perimeter",
};

type StatusFilter =
  | "all"
  | "online"
  | "offline"
  | "untracked"
  | "located"
  | "no-location"
  | "outside";

function LocationsBoard({
  onSelect,
  date,
  onDateChange: setDate,
  deepLink = null,
  onDeepLinkMissing,
}: {
  onSelect: (p: OversightPersonLocation) => void;
  date: string;
  onDateChange: (iso: string) => void;
  /** A person to open once the day's rows load — the profile's deep link (WP-232). */
  deepLink?: string | null;
  /** The deep-linked person has no row for the day, so nobody was opened. */
  onDeepLinkMissing?: () => void;
}) {
  const { inScope, loading: scopeLoading } = useDataScope();
  const { can } = usePermissions();
  // `PUT /v1/org/geofence` needs `MonitoringManage`; everyone else sees the perimeter read-only
  // rather than an editor whose Save always fails (QA audit 2026-10-08, WP-290).
  const canEditFence = can("monitoring:manage");

  const today = isoOf(new Date());
  const isToday = date === today;

  /** The rows, with the day they belong to — so another day's rows never stand in for this one's. */
  const [people, setPeople] = useState<{
    date: string;
    rows: OversightPersonLocation[];
    /** When they were fetched: "online" is judged against this, not against each render's clock. */
    at: number;
    /** Everyone in reach when the server's cap cut the list short (WP-408), else `null`. */
    cappedFrom: number | null;
  } | null>(null);
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The first read has answered (either way) — from then on the page shell stays mounted. */
  const [booted, setBooted] = useState(false);

  const [query, setQuery] = useState("");
  // Shared with the other Analytics tabs through the URL (MON-13).
  const [dept, setDept] = useInsightsDept();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mode, setMode] = useState<"all" | WorkMode>("all");

  /**
   * Live for today: a quiet re-read every 30 s while the tab is visible, plus Refresh. The board was
   * titled "Live map" but read once per date, while "Online" was judged against each render's clock
   * — so after ten minutes the Online filter emptied though every agent was still reporting, and no
   * position ever moved (QA audit 2026-10-08, WP-286). A past day does not change, so it isn't polled.
   */
  const { nonce, reload, isBackground } = useLiveRefresh(
    isToday ? LIVE_REFRESH_MS : null,
  );
  const rows = error === null && people && people.date === date ? people.rows : null;

  // The deep link from an employee profile (`?emp=<id>`, the Location button): once this day's rows
  // are in, open that person exactly as a click would. Applied once — after that the operator's own
  // navigation owns the selection. It used to land on the unfiltered board (QA audit 2026-10-08,
  // WP-232). Someone out of reach, or not on the board, simply leaves the board showing.
  const appliedDeepLink = useRef(false);
  useEffect(() => {
    if (!deepLink || appliedDeepLink.current || rows === null) return;
    appliedDeepLink.current = true;
    const person = rows.find((p) => p.user_id === deepLink);
    if (person) onSelect(person);
    else onDeepLinkMissing?.();
  }, [deepLink, rows, onSelect, onDeepLinkMissing]);
  // Every row in one pass is judged against the same instant: the moment the rows were read.
  const now = people?.at ?? 0;

  // Geofence ("location perimeter") — a client-side admin tool, shared via store.
  const {
    center: fenceCenter,
    radiusM,
    enabled: showFence,
    setCenter,
    setRadius,
    setEnabled,
    reset: resetFence,
    dirty: fenceDirty,
    saving: fenceSaving,
    error: fenceError,
    load: loadFence,
    save: saveFence,
  } = useGeofenceStore();
  const [editingFence, setEditingFence] = useState(false);

  // The perimeter is org-wide config, not per-date data, so it loads once — independent of the
  // date-scoped location fetch below.
  useEffect(() => {
    void loadFence();
  }, [loadFence]);

  useEffect(() => {
    if (!date) return;
    let live = true;
    const background = isBackground();
    if (!background) {
      setLoading(true);
      setError(null);
    }
    getOversightLocations(date)
      .then((d) => {
        if (!live) return;
        setPeople({
          date,
          rows: d.people,
          at: Date.now(),
          cappedFrom: d.truncated && typeof d.total === "number" ? d.total : null,
        });
        setError(null);
        setBooted(true);
      })
      .catch((e) => {
        if (!live) return;
        // A failed poll keeps the last good read; the next one tries again.
        if (background) return;
        setBooted(true);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to the organization's location data."
            : "Couldn't load location data. Check your connection and try again.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [date, nonce, isBackground]);

  // Department names are a best-effort label lookup; the board still works on ids if this fails.
  useEffect(() => {
    let live = true;
    departmentMap()
      .then((m) => live && setDeptNames(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const scoped = useMemo(
    () => (rows ?? []).filter((p) => inScope(p.user_id)),
    [rows, inScope],
  );

  // `unassigned` is the server's sentinel for someone not yet filed under a department.
  const deptLabel = (id: string) =>
    id === "unassigned"
      ? "Unassigned"
      : (deptNames.get(id) ?? (id ? UNKNOWN_DEPARTMENT : ""));
  // Only departments with someone on the board (UX audit MON-23), listed by name rather than by id.
  // Unlike the Screenshots filter this keeps a department whose people reported no location: the
  // board lists them ("No location reported"), and that absence is what a reviewer filtering to it
  // is after. …plus the one in the URL, when another tab picked a department nobody here is in: the
  // filter must name what it is filtering by rather than read "All departments" over an empty list
  // (MON-13).
  const departments = useMemo(() => {
    const present = new Set(scoped.map((p) => p.department_id));
    if (dept !== "all") present.add(dept);
    return Array.from(present).sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, dept, deptNames]);

  /**
   * The rows the department filter keeps — what the report card counts and describes. The card's
   * narrative already followed the filter while its figures counted the whole organization beside it.
   */
  const inDept = useMemo(
    () => (dept === "all" ? scoped : scoped.filter((p) => p.department_id === dept)),
    [scoped, dept],
  );

  const fence = { center: fenceCenter, radiusM };
  /** Inside / outside / too coarse to place — the fix's own accuracy counts (see `perimeterVerdict`). */
  const verdictOf = (p: OversightPersonLocation) =>
    p.latest ? perimeterVerdict(toGeoPoint(p.latest), p.latest.accuracy_m, fence) : null;
  const flagOutside = (p: OversightPersonLocation) =>
    showFence && verdictOf(p) === "outside";

  const locatedCount = inDept.filter((p) => p.latest).length;
  const outsideCount = inDept.filter(flagOutside).length;
  const insideCount = showFence
    ? inDept.filter((p) => verdictOf(p) === "inside").length
    : 0;
  const imprecise = showFence ? locatedCount - insideCount - outsideCount : 0;

  // On-site / off-site are only meaningful once an office perimeter is set (the geofence toggle).
  // Without one we don't invent a number — the AI hero tiles read an honest note instead.
  const onSiteCount = showFence ? insideCount : null;
  const offSiteCount = showFence ? outsideCount : null;

  // Publish the location board's day + counts to the assistant — or that there are none to give.
  useAssistantPageContext({
    date: date || null,
    facts: [
      ...(rows === null
        ? [
            {
              label: "Status",
              value: error ? "the day's locations failed to load" : "still loading",
            },
          ]
        : [
            { label: "People", value: String(inDept.length) },
            { label: "Located (have a fix)", value: String(locatedCount) },
          ]),
      ...(rows !== null && showFence && onSiteCount !== null && offSiteCount !== null
        ? [
            { label: "On-site", value: String(onSiteCount) },
            { label: "Off-site", value: String(offSiteCount) },
          ]
        : []),
      ...(dept !== "all" ? [{ label: "Department filter", value: deptLabel(dept) }] : []),
      ...(query.trim() ? [{ label: "Search", value: query.trim() }] : []),
    ],
  });

  const label = dateLabel(date);

  /**
   * The day's AI narrative (`insights::location_summary`).
   *
   * This card was titled "AI location report" while the sentence under it was assembled from a
   * template string in this file — a surface labelled AI that never called a model. It calls one
   * now, over figures the server computes from the same reach-narrowed read the map plots, so the
   * two cannot disagree.
   *
   * A failure keeps the card usable rather than blanking it: the local recap below is the same
   * facts in our own words, so the page still answers the question when the model doesn't.
   */
  // Plurals agree with the count ("0 of 1 employees", UX audit MON-23); the date is the one notation.
  const ofEmployees = `${locatedCount} of ${countOf(inDept.length, "employee")}`;
  const localRecap =
    rows === null
      ? error
        ? `Location data for ${label} couldn't be loaded, so there is nothing to summarize yet.`
        : `Reading the locations for ${label}…`
      : inDept.length === 0
        ? `No employees in view for ${label}.`
        : locatedCount === 0
          ? `${ofEmployees} reported a location on ${label}.`
          : showFence
            ? `${ofEmployees} reported a location on ${label}: ${onSiteCount} inside the office perimeter, ${offSiteCount} outside it${
                imprecise > 0 ? `, ${imprecise} too imprecise to place` : ""
              }.`
            : `${ofEmployees} reported a location on ${label}. No office perimeter is set, so on-site and off-site can't be told apart.`;

  /** The department's display name for the narrative — undefined for the org-wide view. */
  const deptAiLabel = dept === "all" ? undefined : deptLabel(dept);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  /** What the narrative was written over — enough to tell model text from the server's own line. */
  const [aiMeta, setAiMeta] = useState<{
    located: number;
    generatedAt: number;
    /** The server's own word on who wrote it (MON-08); absent from servers that predate it. */
    aiGenerated?: boolean;
    model?: string | null;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  /** The (date, department) a Regenerate is running for, or `null`. */
  const [regenFor, setRegenFor] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const aiSelection = `${date}|${dept}`;
  const aiCurrent = useRef(aiSelection);
  useEffect(() => {
    aiCurrent.current = aiSelection;
  }, [aiSelection]);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setAiLoading(true);
    setAiNarrative(null);
    setAiMeta(null);
    setAiNotice(null);
    // Re-fetches on a department change as well as a date change: the board's counts already
    // follow the filter, and the narrative used to describe the whole org beside them.
    getLocationSummary({ date, department: dept, label: deptAiLabel })
      .then((s) => {
        if (!live) return;
        setAiNarrative(s.narrative);
        setAiMeta({
          located: s.metrics.located,
          generatedAt: s.generated_at,
          aiGenerated: s.ai_generated,
          model: s.model,
        });
      })
      .catch(() => live && setAiNarrative(null))
      .finally(() => live && setAiLoading(false));
    return () => {
      live = false;
    };
  }, [date, dept, deptAiLabel]);

  async function regenerateAi() {
    if (regenFor === aiSelection || !date) return;
    const started = aiSelection;
    setRegenFor(started);
    setAiNotice(null);
    try {
      const s = await regenerateLocationSummary({
        date,
        department: dept,
        label: deptAiLabel,
      });
      // A slow re-run must not put one department's (or day's) narrative under another's
      // (QA audit 2026-10-08, WP-278).
      if (aiCurrent.current === started) {
        setAiNarrative(s.narrative);
        setAiMeta({
          located: s.metrics.located,
          generatedAt: s.generated_at,
          aiGenerated: s.ai_generated,
          model: s.model,
        });
      }
    } catch {
      // Keep what's on screen — a failed re-run must not blank the card — but say it failed.
      if (aiCurrent.current === started) {
        setAiNotice("Couldn't regenerate the report — showing the previous one.");
      }
    } finally {
      setRegenFor((k) => (k === started ? null : k));
    }
  }

  /**
   * Who wrote the text on the card (UX audit 2026-10-16, MON-08 / XC-08), read from what
   * `insights::location_summary` actually does: the server writes its own factual line — no model —
   * when nobody in view was located, when the provider fails, and whenever the org's AI insights are
   * off (the plain `is_effective` check, no owner exemption — hence the store's own reading, not the
   * owner-exempt hook). It says so with `ai_generated: false`; an older server only by `located: 0`.
   */
  const aiInsightsOn = useEntitlementsStore((st) =>
    effectiveFromState(st, "ai.insights"),
  );
  const modelWrote =
    !!aiNarrative &&
    !!aiMeta &&
    aiMeta.aiGenerated !== false &&
    aiMeta.located > 0 &&
    aiInsightsOn;
  /**
   * The model's narrative when it wrote one; otherwise our own recap of the same figures. The
   * server's own line printed the day as `2026-10-16` beside a date picker reading "16 Oct 2026"
   * (UX audit MON-23) — the recap says it in the page's notation, and agrees its plurals.
   */
  const aiSummary =
    aiLoading && !aiNarrative
      ? "Reading the day's locations…"
      : modelWrote
        ? aiNarrative!
        : localRecap;
  const aiProvenance: Provenance =
    aiLoading && !aiNarrative
      ? { kind: "none" }
      : modelWrote
        ? {
            kind: "ai",
            generatedAt: aiMeta!.generatedAt,
            ...(aiMeta!.model ? { model: aiMeta!.model } : {}),
          }
        : { kind: "computed" };

  const q = query.trim().toLowerCase();
  const matchesStatus = (p: OversightPersonLocation) => {
    if (status === "all") return true;
    if (status === "located") return p.latest !== null;
    if (status === "no-location") return p.latest === null;
    if (status === "outside") return flagOutside(p);
    return deriveStatus(p.latest?.captured_at ?? null, p.fix_count, now) === status;
  };

  // Mode is derived from the perimeter, so with the fence off nothing has a mode and the filter
  // would silently empty the board. Treat it as inactive instead.
  const matchesMode = (p: OversightPersonLocation) => {
    if (mode === "all" || !showFence) return true;
    return (
      deriveMode(
        p.latest ? toGeoPoint(p.latest) : null,
        fence,
        showFence,
        p.latest?.accuracy_m,
      ) === mode
    );
  };
  const employees = useMemo(
    () =>
      scoped.filter(
        (p) =>
          (dept === "all" || p.department_id === dept) &&
          matchesStatus(p) &&
          matchesMode(p) &&
          (q === "" || p.name.toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, dept, status, mode, q, radiusM, fenceCenter, showFence, now],
  );

  const mapMarkers: MapMarker[] = useMemo(
    () =>
      employees
        .filter((p) => p.latest)
        .map((p) => ({
          id: p.user_id,
          point: toGeoPoint(p.latest!),
          variant: "avatar" as const,
          name: `${p.name}${flagOutside(p) ? " · outside perimeter" : ""}`,
          // What a keyboard or screen-reader user is about to open (MON-22).
          label: `Open ${p.name}'s locations${flagOutside(p) ? " — outside the office perimeter" : ""}`,
          // The same definition of "online" as the Online filter beside it. The dot was simply
          // "it's today", so a fix from 08:00 still wore it at 17:00 (WP-286).
          online: deriveStatus(p.latest!.captured_at, p.fix_count, now) === "online",
          alert: flagOutside(p),
          accuracyM: p.latest!.accuracy_m,
          onClick: () => onSelect(p),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, showFence, radiusM, fenceCenter, onSelect, now],
  );

  /**
   * Frame the people, not the office: re-fit when the day or a filter changes, never on a poll —
   * that would yank the map away from wherever the reader had panned (QA audit 2026-10-08, WP-287).
   */
  const fitPoints = useMemo(() => mapMarkers.map((m) => m.point), [mapMarkers]);
  // Not on search keystrokes: re-framing the map per letter typed would make it lurch.
  const fitKey = rows === null ? undefined : `${date}|${dept}|${status}|${mode}`;

  // Only the very first read replaces the page with a loader. After that the page — the date
  // stepper and the map — stays mounted: swapping it out tore down and rebuilt the WebGL map on
  // every day stepped through, re-downloading its style and tiles and losing pan, zoom and the
  // lock (WP-287), and a failed read took the stepper with it, leaving nothing to click (WP-288).
  if (!date || (!booted && (loading || scopeLoading))) {
    return <Loader />;
  }

  return (
    <div className="space-y-5">
      {/* AI location report — a factual recap over the day's real fixes + the office perimeter. */}
      <AiReportCard
        // "AI" in the title only over text a model wrote (MON-08); the department it describes, as
        // the Screenshots card names it.
        title={`${aiProvenance.kind === "ai" ? "AI location report" : "Location report"}${
          dept === "all" ? "" : ` · ${deptLabel(dept)}`
        }`}
        summary={aiSummary}
        provenance={aiProvenance}
        // Only over a day with someone located — the data a model run analyses — and with AI
        // insights on: otherwise the server answers with its own fixed line and no model call, so
        // each press would buy the same sentence (UX audit MON-21).
        onRegenerate={
          canRegenerate((aiMeta?.located ?? 0) > 0, aiNarrative) && aiInsightsOn
            ? regenerateAi
            : undefined
        }
        regenerating={regenFor === aiSelection}
        notice={aiNotice}
        metrics={
          rows === null
            ? // No read for this day (yet, or it failed): counts here would be a false zero.
              [
                { label: "Employees", value: "—" },
                { label: isToday ? "Located today" : "Located", value: "—" },
                { label: "On-site", value: "—" },
                { label: "Off-site", value: "—" },
                { label: "No location", value: "—" },
              ]
            : [
                { label: nounFor(inDept.length, "Employee"), value: inDept.length },
                // No "last seen" beside the figure: it read "0 last seen" (UX audit MON-23).
                { label: isToday ? "Located today" : "Located", value: locatedCount },
                showFence
                  ? { label: "On-site", value: onSiteCount ?? 0 }
                  : { label: "On-site", value: "—", hint: "no perimeter set" },
                showFence
                  ? {
                      label: "Off-site",
                      value: offSiteCount ?? 0,
                      hint:
                        imprecise > 0 ? `${imprecise} too imprecise to place` : undefined,
                    }
                  : { label: "Off-site", value: "—", hint: "no perimeter set" },
                { label: "No location", value: inDept.length - locatedCount },
              ]
        }
      />

      {/* Pull the latest positions without a page reload — the same slot every other page uses. */}
      <PageActions>
        <RefreshButton onRefresh={reload} refreshing={loading} />
      </PageActions>

      {/* Live map */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isToday ? "Live map · latest positions" : `${label} · locations`}
              </p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                {rows === null && !error ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Loading {label}…
                  </>
                ) : (
                  <>
                    {mapMarkers.length} {mapMarkers.length === 1 ? "person" : "people"} on
                    the map
                    {isToday && rows !== null && now > 0
                      ? ` · updated ${clock(now)}`
                      : ""}
                    {people?.cappedFrom != null && rows !== null
                      ? ` · showing the first ${rows.length} of ${people.cappedFrom} people by name`
                      : ""}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Date stepper */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Previous day"
                  onClick={() => setDate(shiftIso(date, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <DatePicker
                  value={date}
                  max={today}
                  onChange={(v) => v && setDate(v)}
                  className="w-40"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Next day"
                  disabled={isToday}
                  onClick={() => setDate(shiftIso(date, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {/* Names, not ids: the options were the raw `dept-01K…` ids although the names had
                  already been loaded (QA audit 2026-10-08, WP-289). */}
              <DepartmentFilter
                value={dept}
                onChange={setDept}
                options={departments.map((d) => ({ value: d, label: deptLabel(d) }))}
                ariaLabel="Filter locations by department"
              />

              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="h-8 w-44" aria-label="Status">
                  <SelectValue>
                    {(v) => STATUS_LABEL[v as StatusFilter] ?? "All status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="untracked">Untracked</SelectItem>
                  <SelectItem value="located">Located</SelectItem>
                  <SelectItem value="no-location">No location</SelectItem>
                  <SelectItem value="outside">Outside perimeter</SelectItem>
                </SelectContent>
              </Select>

              {/*
                Mode is *derived from the perimeter*, not a declared work arrangement — WorkPulse has
                no such field (owner decision, 2026-07-22). With the fence switched off there is
                nothing to derive from, so the control is disabled rather than left to silently empty
                the board.
              */}
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "all" | WorkMode)}
                disabled={!showFence}
              >
                <SelectTrigger
                  className="h-8 w-36"
                  aria-label="Work mode"
                  title={
                    showFence
                      ? "Derived from the office perimeter"
                      : "Set an office perimeter to filter by mode"
                  }
                >
                  <SelectValue>
                    {(v) =>
                      v === "in-office" || v === "remote"
                        ? WORK_MODE_LABEL[v as WorkMode]
                        : "All modes"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="in-office">In office</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <LiveMap
            markers={mapMarkers}
            geofence={showFence ? fence : null}
            editableCenter={canEditFence && showFence && editingFence}
            onCenterChange={setCenter}
            center={fenceCenter}
            zoom={13}
            recenterKey="board"
            fitPoints={fitPoints}
            fitKey={fitKey}
            // A whole office lands on one spot; overlapping faces become one numbered bubble (MON-22).
            cluster
          />

          {/*
            Perimeter control — an editor for `monitoring:manage`, a read-out for everyone else.

            It is the **organization's** perimeter, not a view toggle: the checkbox sat beside the
            map's filters looking like "show the circle on my map", while it changes whether everyone
            in the organization is placed on-site or off-site (UX audit 2026-10-16, MON-22). Hence
            the fieldset and legend naming it an organization setting, and the line saying what Save
            does. Nothing is written until Save — see `useGeofenceStore`, whose setters stay local —
            so it needs no confirmation of its own; the unsaved state says so instead.
          */}
          <fieldset className="space-y-2 rounded-xl border px-3 pt-1 pb-2.5 text-xs">
            <legend className="px-1 text-xs font-semibold">
              Office perimeter{" "}
              <span className="text-muted-foreground font-normal">· organization setting</span>
            </legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {!canEditFence ? (
                <span className="font-medium">
                  {showFence ? (
                    <>
                      {radiusM} m radius ·{" "}
                      <span
                        className={cn(
                          outsideCount > 0 ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {outsideCount} outside
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      No office perimeter is set for your organization.
                    </span>
                  )}
                </span>
              ) : (
                <label className="flex items-center gap-1.5 font-medium">
                  <input
                    type="checkbox"
                    checked={showFence}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="size-3.5"
                    style={{ accentColor: "var(--primary)" }}
                    aria-describedby="perimeter-scope"
                  />
                  Use an office perimeter
                </label>
              )}
              {canEditFence && showFence ? (
                <>
                  <input
                    type="range"
                    min={100}
                    max={2000}
                    step={50}
                    value={radiusM}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-40"
                    style={{ accentColor: "var(--primary)" }}
                    aria-label="Perimeter radius"
                  />
                  <span className="text-muted-foreground tabular-nums">
                    {radiusM} m radius
                  </span>
                  <span
                    className={cn(
                      outsideCount > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    · {outsideCount} outside
                  </span>
                  <Button
                    variant={editingFence ? "default" : "outline"}
                    size="sm"
                    className="h-7"
                    onClick={() => setEditingFence((v) => !v)}
                  >
                    {editingFence ? "Done" : "Move office"}
                  </Button>
                </>
              ) : null}
              {/*
                Saving is explicit and only offered when something actually changed. The perimeter is
                org-wide, so an accidental autosave would move every colleague's inside/outside status;
                and without the dirty check there is no way to tell a dragged-but-unsaved fence from the
                saved one. Reset undoes those edits — back to the saved perimeter — so it appears with
                them; outside the `showFence` block, so switching the perimeter off can be undone too.
              */}
              {canEditFence && fenceDirty ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      resetFence();
                      setEditingFence(false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={fenceSaving}
                    onClick={() => {
                      void saveFence().then((ok) => ok && setEditingFence(false));
                    }}
                  >
                    {fenceSaving ? "Saving…" : "Save for everyone"}
                  </Button>
                </>
              ) : null}
              {/* Load failures too, for everyone — they used to show only inside the editor, which a
                  failed load had switched off, so they were never seen. */}
              {fenceError ? <span className="text-destructive">{fenceError}</span> : null}
            </div>
            {canEditFence ? (
              <p
                id="perimeter-scope"
                className={cn(fenceDirty ? "text-warning font-medium" : "text-muted-foreground")}
                role="status"
              >
                {fenceDirty
                  ? "Unsaved change — only you can see it. Save for everyone to apply it to the whole organization, or Reset to undo it."
                  : "Changes apply to everyone in your organization once you save — who counts as on-site or off-site follows this perimeter."}
              </p>
            ) : null}
          </fieldset>

          <p className="text-muted-foreground text-xs">
            Positions are the latest location the desktop agent reported that day, only where the
            device allows it; a shaded circle shows how accurate it is. Overlapping people are
            grouped into a numbered circle — select it to zoom in. The office perimeter is a review
            aid — a red ring marks someone outside it, beyond the fix&apos;s accuracy.
          </p>
        </CardContent>
      </Card>

      {/* Count + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">{employees.length}</span> of{" "}
          {countOf(scoped.length, "employee")}
        </p>
        <div className="relative w-full sm:w-64">
          <Search
            className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          {/* Named for assistive tech — the placeholder alone vanished once typing began (MON-22). */}
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee…"
            aria-label="Search employees by name"
            className="h-9 w-full pl-8"
          />
        </div>
      </div>

      {status === "outside" ? (
        <div className="border-destructive/30 bg-destructive/10 flex items-start gap-3 rounded-2xl border px-4 py-3">
          <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="text-foreground font-medium">
              Employees outside the office perimeter
            </p>
            <p className="text-muted-foreground mt-0.5">
              These employees&apos; latest fix is beyond the {radiusM} m office perimeter
              for this day, even allowing for its accuracy.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        // In place of the list, with the stepper and map still on the page: this used to replace
        // the whole board, so one failed read left nothing to click but browser reload (WP-288).
        <EmptyState
          icon={MapPinOff}
          title="Location data unavailable"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : rows === null ? (
        <div className="flex min-h-[10rem] items-center justify-center">
          <Loader label={`Loading the locations for ${label}…`} />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            scoped.length === 0 ? "No location data for this day" : "No employees match"
          }
          description={
            scoped.length === 0
              ? "Needs the desktop agent's consented location reporting — positions appear once the agent is installed and consent is granted."
              : "Try a different name, department, or status."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((p) => {
            const located = p.latest !== null;
            const outside = flagOutside(p);
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => onSelect(p)}
                className="group bg-card hover:ring-primary/40 flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:ring-1"
              >
                <UserAvatar
                  userId={p.user_id}
                  name={p.name}
                  className="size-10"
                  fallbackClassName="text-xs"
                />
                {/* The status wraps rather than truncating — "No location rep…" hid the one fact
                    the card is for (UX audit MON-23). */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{p.name}</p>
                  {outside ? (
                    <p className="text-destructive flex items-start gap-1 text-xs">
                      <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                      <span>Outside perimeter · {clock(p.latest!.captured_at)}</span>
                    </p>
                  ) : located ? (
                    <p className="text-muted-foreground flex items-start gap-1 text-xs">
                      <Navigation className="text-primary mt-px size-3 shrink-0" aria-hidden="true" />
                      <span>
                        Last seen {clock(p.latest!.captured_at)} ·{" "}
                        {countOf(p.fix_count, "location")}
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground flex items-start gap-1 text-xs">
                      <MapPinOff className="mt-px size-3 shrink-0" aria-hidden="true" />
                      <span>No location reported</span>
                    </p>
                  )}
                </div>
                {/* No "Located" / "—" badge: it repeated the status line beside it ("—" beside "No
                    location reported") and took the width that squeezed the status into an
                    ellipsis (MON-23). */}
                <ChevronRight className="text-muted-foreground size-4 shrink-0 transition group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
