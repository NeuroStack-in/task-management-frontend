"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Flag,
  RefreshCw,
  TrendingDown,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { countOf } from "../lib/plural";
import {
  buildAttentionPeople,
  LOW_SCORE_BELOW,
  SEVERITY_LABEL,
  type AttentionPerson,
  type Severity,
} from "../lib/attention";
import { useAttention, type AttentionState, type Signal } from "../use-attention";
import { PersonLink } from "./person-link";

/**
 * **Needs attention** — the Analytics hub's one answer to "what needs my attention on this day"
 * (UX audit 2026-10-16, MON-03), with the people behind it — the **Alerts** block, which
 * `/insights/anomalies` now opens (MON-06).
 *
 * The audit found six attention signals with different windows and rules in four places, none
 * linked. Here every signal follows **one** day — the page's date — and each says what it counts,
 * why, and where to act on it. A signal that failed says so; one the viewer's role can't read isn't
 * shown; nothing reads as "0" that wasn't counted.
 */

/** The id `/insights/anomalies` redirects to (`#alerts`). */
export const ALERTS_ANCHOR = "alerts";

type Filter = "all" | "alerts" | "low" | "flags" | "silent";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Everyone",
  alerts: "Alerts",
  low: "Low scores",
  flags: "Awaiting review",
  silent: "Not reporting",
};

const matches: Record<Filter, (p: AttentionPerson) => boolean> = {
  all: () => true,
  alerts: (p) => p.severity !== null,
  low: (p) => p.lowScore !== null,
  flags: (p) => p.openFlags > 0,
  silent: (p) => p.silentSince !== null,
};

/** The list shows this many until asked for the rest. */
const LIST_PREVIEW = 10;

const SEVERITY_TONE: Record<Severity, string> = {
  high: "bg-destructive/12 text-destructive",
  medium: "bg-warning/15 text-warning",
  low: "bg-muted text-muted-foreground",
};

/** The one date notation (UX audit XC-06 / MON-23): "Fri, 16 Oct 2026". */
function dayLabel(iso: string, today: string): string {
  if (!iso) return "";
  const label = formatDate(iso, { weekday: true });
  return iso === today ? `${label} (today)` : label;
}

function shortDate(ms: number): string {
  return formatDate(ms, { weekday: true });
}

const readyData = <T,>(s: Signal<T>): T | null => (s.status === "ready" ? s.data : null);

export function AttentionPanel({ date, today }: { date: string; today: string }) {
  const state = useAttention(date);
  const [filter, setFilter] = useState<Filter>("all");
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // A new day starts from the whole list.
  useEffect(() => {
    setFilter("all");
    setShowAll(false);
  }, [date]);

  const people = useMemo(
    () =>
      buildAttentionPeople({
        alerts: readyData(state.alerts)?.rows ?? null,
        people: readyData(state.people),
        flags: readyData(state.flags),
        silent: readyData(state.agents)?.silent ?? null,
      }),
    [state.alerts, state.people, state.flags, state.agents],
  );

  const signals = [state.flags, state.alerts, state.people, state.agents];
  const settled = signals.every((s) => s.status !== "loading");
  const anyShown = signals.some((s) => s.status !== "off");

  // `/insights/anomalies` lands here as `#alerts`. The block exists from the first render, but what
  // sits above it grows as it loads, so the browser's own jump lands short — scroll once it settles.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !settled || !date) return;
    if (typeof window === "undefined" || window.location.hash !== `#${ALERTS_ANCHOR}`) return;
    jumped.current = true;
    listRef.current?.scrollIntoView({ block: "start" });
  }, [settled, date]);

  if (!anyShown) return null;

  const counts: Record<Filter, number> = {
    all: people.length,
    alerts: people.filter(matches.alerts).length,
    low: people.filter(matches.low).length,
    flags: people.filter(matches.flags).length,
    silent: people.filter(matches.silent).length,
  };
  const visible = people.filter(matches[filter]);
  const shown = showAll ? visible : visible.slice(0, LIST_PREVIEW);

  const seeWho = (f: Filter) => {
    setFilter(f);
    setShowAll(false);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const label = dayLabel(date, today);

  return (
    <section aria-labelledby="attention-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="attention-title" className="font-heading text-base font-semibold">
            Needs attention{label ? ` · ${label}` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">
            Every signal here covers the same day — the date above.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={state.reload} disabled={!settled}>
          <RefreshCw className={cn("size-3.5", !settled && "animate-spin")} aria-hidden="true" />
          {settled ? "Check again" : "Checking…"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FlagsTile state={state} date={date} />
        <AlertsTile state={state} onSeeWho={() => seeWho("alerts")} />
        <LowScoreTile state={state} onSeeWho={() => seeWho("low")} />
        <AgentsTile state={state} />
      </div>

      <div
        id={ALERTS_ANCHOR}
        ref={listRef}
        className="scroll-mt-24 rounded-2xl border border-border bg-card"
      >
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-semibold">
            Alerts and who needs attention{label ? ` · ${label}` : ""}
          </h4>
          {people.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
              {(Object.keys(FILTER_LABEL) as Filter[])
                .filter((f) => f === "all" || f === filter || counts[f] > 0)
                .map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => {
                      setFilter(f);
                      setShowAll(false);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {FILTER_LABEL[f]} · {counts[f]}
                  </button>
                ))}
            </div>
          ) : null}
        </div>

        {!date || (!settled && people.length === 0) ? (
          <div className="flex min-h-[7rem] items-center justify-center">
            <Loader label="Checking what needs attention…" />
          </div>
        ) : people.length === 0 ? (
          <AllClear state={state} label={label} />
        ) : (
          <>
            {visible.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nobody at this filter now — pick another above.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {shown.map((p) => (
                  <PersonRow key={p.userId} person={p} date={date} />
                ))}
              </ul>
            )}
            {visible.length > LIST_PREVIEW ? (
              <div className="border-t border-border px-5 py-2.5">
                <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${visible.length}`}
                </Button>
              </div>
            ) : null}
            {!settled ? (
              <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground" role="status">
                Still checking some signals — the list may grow.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- tiles ---------------------------------- */

function Tile({
  icon: Icon,
  label,
  signal,
  count,
  unit,
  reason,
  note,
  action,
  onRetry,
}: {
  icon: LucideIcon;
  label: string;
  signal: Signal<unknown>;
  count?: string;
  unit?: string;
  reason?: string;
  note?: string | null;
  action?: React.ReactNode;
  onRetry: () => void;
}) {
  if (signal.status === "off") return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      {/* Label and figure on one line — four tiles stack on a phone, and a line each adds up. */}
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 pt-1 text-sm font-medium text-muted-foreground">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          {label}
        </span>
        {signal.status === "ready" ? (
          <span className="flex shrink-0 items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold tabular-nums">{count}</span>
            {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
          </span>
        ) : signal.status === "error" ? (
          // A failed read is not a count of zero.
          <span className="font-display text-2xl font-semibold text-muted-foreground">—</span>
        ) : null}
      </div>
      {signal.status === "loading" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Checking…
        </p>
      ) : signal.status === "error" ? (
        <>
          <p className="text-xs text-muted-foreground">{signal.message}</p>
          {signal.denied ? null : (
            <Button variant="outline" size="sm" className="mt-auto self-start" onClick={onRetry}>
              Try again
            </Button>
          )}
        </>
      ) : (
        <>
          {reason ? <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p> : null}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          {action ? <div className="mt-auto pt-1">{action}</div> : null}
        </>
      )}
    </div>
  );
}

function TileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" render={<Link href={href} />} nativeButton={false}>
      {children} <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function TileButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {children} <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function FlagsTile({ state, date }: { state: AttentionState; date: string }) {
  const s = state.flags;
  const d = s.status === "ready" ? s.data : null;
  const people = d ? d.byUser.size : 0;
  const unchecked = d ? d.read - d.analysed : 0;
  let reason: string | undefined;
  let note: string | null = null;
  if (d) {
    if (d.read === 0) {
      reason = "No screenshots were captured on this day.";
    } else if (d.open > 0) {
      reason = `Across ${countOf(people, "person", "people")}. The AI judged these not work for the person's role, and nobody has confirmed or dismissed them yet.`;
    } else {
      // "Nothing flagged" must never stand in for "nothing checked" (MON-01).
      // "Nothing flagged in the 0 the AI has checked" when it had checked none (MON-23).
      reason =
        unchecked > 0
          ? d.analysed === 0
            ? `The AI hasn't checked any of the ${countOf(d.read, "capture")} yet.`
            : `Nothing flagged in the ${d.analysed.toLocaleString()} the AI has checked — ${unchecked.toLocaleString()} not checked yet.`
          : "Nothing flagged — the AI has checked every capture.";
    }
    note = d.truncated
      ? `Counted in the first ${d.read.toLocaleString()}${d.total ? ` of ${d.total.toLocaleString()}` : ""} captures — there may be more.`
      : d.read > 0 && d.open > 0
        ? `AI-checked ${d.analysed.toLocaleString()} of ${countOf(d.read, "capture")}.`
        : null;
  }
  const q = new URLSearchParams({ date, show: "review" });
  return (
    <Tile
      icon={Flag}
      label="Awaiting review"
      signal={s}
      count={d ? `${d.open.toLocaleString()}${d.truncated ? "+" : ""}` : undefined}
      unit={d ? (d.open === 1 ? "capture" : "captures") : undefined}
      reason={reason}
      note={note}
      onRetry={state.reload}
      action={d && d.read > 0 ? <TileLink href={`/insights/screenshots?${q.toString()}`}>Review</TileLink> : null}
    />
  );
}

function AlertsTile({ state, onSeeWho }: { state: AttentionState; onSeeWho: () => void }) {
  const s = state.alerts;
  const data = s.status === "ready" ? s.data : null;
  const rows = data ? data.rows : null;
  const flagged = rows ?? [];
  const high = flagged.filter((r) => r.severity === "high").length;
  // The rules that actually fired, not a list of every rule there is.
  const fired = [...new Set(flagged.flatMap((r) => r.alerts.map((a) => a.label)))];
  const firedText =
    fired.length > 2 ? `${fired.slice(0, 2).join("; ")}; and ${fired.length - 2} more.` : `${fired.join("; ")}.`;
  return (
    <Tile
      icon={AlertTriangle}
      label="Alerts"
      signal={s}
      count={rows ? String(flagged.length) : undefined}
      unit={rows ? (flagged.length === 1 ? "person" : "people") : undefined}
      reason={
        rows
          ? flagged.length > 0
            ? `${high > 0 ? `${high} high severity. ` : ""}${firedText}`
            : "No anomaly rule fired for anyone this day."
          : undefined
      }
      // The server now lists everyone a rule fired for (MON-06); only an older server's capped
      // ranking can leave someone out, and then the tile says so.
      note={data?.capped ? "Only the most urgent people were sent — there may be more." : null}
      onRetry={state.reload}
      action={flagged.length > 0 ? <TileButton onClick={onSeeWho}>See who</TileButton> : null}
    />
  );
}

function LowScoreTile({ state, onSeeWho }: { state: AttentionState; onSeeWho: () => void }) {
  const s = state.people;
  const people = s.status === "ready" ? s.data : null;
  const scored = people ? people.filter((p) => p.breakdown) : [];
  const low = scored.filter((p) => (p.breakdown?.score ?? 100) < LOW_SCORE_BELOW);
  return (
    <Tile
      icon={TrendingDown}
      label="Low scores"
      signal={s}
      count={people ? String(low.length) : undefined}
      unit={people ? (low.length === 1 ? "person" : "people") : undefined}
      reason={
        people
          ? scored.length === 0
            ? "Nobody has a productivity score for this day yet."
            : `Productivity score below ${LOW_SCORE_BELOW} for the day.`
          : undefined
      }
      note={
        people && scored.length > 0
          ? `${scored.length} of ${countOf(people.length, "person", "people")} scored.`
          : null
      }
      onRetry={state.reload}
      action={low.length > 0 ? <TileButton onClick={onSeeWho}>See who</TileButton> : null}
    />
  );
}

function AgentsTile({ state }: { state: AttentionState }) {
  const s = state.agents;
  const d = s.status === "ready" ? s.data : null;
  const since = d?.sinceDay ? formatDate(d.sinceDay, { weekday: true }) : "";
  return (
    <Tile
      icon={WifiOff}
      label="Agents not reporting"
      signal={s}
      count={d ? String(d.silent.length) : undefined}
      unit={d ? (d.silent.length === 1 ? "device" : "devices") : undefined}
      reason={
        d
          ? d.silent.length > 0
            ? `No heartbeat since before ${since}, the last workday. Right now — not a past day's figure.`
            : `Every active device has reported since ${since}, the last workday.`
          : undefined
      }
      onRetry={state.reload}
      action={d && d.silent.length > 0 ? <TileLink href="/settings/agents">Device agents</TileLink> : null}
    />
  );
}

/* --------------------------------- the list -------------------------------- */

function PersonRow({ person: p, date }: { person: AttentionPerson; date: string }) {
  const weakest = p.drivers.slice(0, 2);
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <PersonLink userId={p.userId} name={p.name} date={date} className="text-sm font-medium" />
        {p.alerts.length > 0 ? (
          // Each rule with the server's own account of why it fired — the figure and the org's
          // threshold (MON-06). An older server sends the rule alone.
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {p.alerts.map((a) => (
              <li key={a.type}>
                {a.label}
                {a.detail ? <span className="text-xs"> — {a.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {p.lowScore !== null && weakest.length > 0 ? (
          // What drove the score — the weakest parts of the four the score is built from (MON-04).
          <p className="text-xs text-muted-foreground">
            Pulled down most by{" "}
            {weakest.map((w, i) => (
              <span key={w.key}>
                {i > 0 ? " and " : ""}
                <span className="font-medium text-foreground">{w.label}</span> {w.value}
              </span>
            ))}{" "}
            (each out of 100)
          </p>
        ) : null}
        {p.silentSince !== null ? (
          <p className="text-xs text-muted-foreground">
            Their agent hasn&apos;t reported since {shortDate(p.silentSince)}.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
        {p.severity ? (
          <Badge className={SEVERITY_TONE[p.severity]}>
            <AlertTriangle aria-hidden="true" />
            {SEVERITY_LABEL[p.severity]} alert
          </Badge>
        ) : null}
        {p.openFlags > 0 ? (
          <Badge className="bg-warning/15 text-warning">
            <Flag aria-hidden="true" />
            {countOf(p.openFlags, "capture")} to review
          </Badge>
        ) : null}
        {p.lowScore !== null ? (
          <Badge className="bg-muted text-foreground">Score {p.lowScore}</Badge>
        ) : null}
        {p.silentSince !== null ? (
          <Badge className="bg-muted text-muted-foreground">
            <WifiOff aria-hidden="true" />
            Agent silent
          </Badge>
        ) : null}
      </div>
    </li>
  );
}

/** Nobody to list — said with what was actually checked, never a bare "all clear". */
function AllClear({ state, label }: { state: AttentionState; label: string }) {
  const failed = [
    ["captures awaiting review", state.flags],
    ["alerts", state.alerts],
    ["scores", state.people],
    ["device status", state.agents],
  ].filter(([, s]) => (s as Signal<unknown>).status === "error") as [string, Signal<unknown>][];
  const flags = readyData(state.flags);
  const unchecked = flags ? flags.read - flags.analysed : 0;
  // Only what was actually checked — a signal outside the viewer's role claims nothing.
  const clear = [
    state.alerts.status === "ready" ? "no alert fired" : null,
    state.people.status === "ready" ? `no score fell below ${LOW_SCORE_BELOW}` : null,
    flags ? "no capture is waiting for review" : null,
    state.agents.status === "ready" ? "every active agent has reported" : null,
  ].filter(Boolean) as string[];
  const clearText = clear.length
    ? `${clear.slice(0, -1).join(", ")}${clear.length > 1 ? " and " : ""}${clear[clear.length - 1]}.`
    : "";
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-success/12 text-success">
        <Check className="size-4" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">
        {failed.length > 0 ? "Nothing found in what could be checked" : `Nothing needs attention${label ? ` on ${label}` : ""}`}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {failed.length > 0
          ? `Couldn't check ${failed.map(([name]) => name).join(", ")} — see above.`
          : clearText.charAt(0).toUpperCase() + clearText.slice(1)}
        {unchecked > 0
          ? ` ${countOf(unchecked, "capture")} ${unchecked === 1 ? "hasn't" : "haven't"} been checked by the AI yet.`
          : ""}
      </p>
    </div>
  );
}
