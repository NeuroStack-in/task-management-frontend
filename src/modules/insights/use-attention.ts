"use client";

/**
 * The reads behind the Analytics hub's "Needs attention" panel, for one day (UX audit 2026-10-16,
 * MON-03 / MON-06). The rules that combine them live in `lib/attention.ts`.
 *
 * Each signal loads on its own and fails on its own: a slow screenshot read must not hold back the
 * alerts, and a signal that failed or was refused says so — it never reads as "0". A signal the
 * viewer's role can't read is `off` and simply isn't shown.
 *
 * Only existing GET routes, through their module services:
 *  - captures awaiting review — `GET /v1/insights/screenshots?date=` (`screenshots:view`), paged
 *    within a budget; past it the count is "at least" and says how much it read;
 *  - alerts — `GET /v1/insights/attention?date=` (`ai:view` + `anomalies:view`); only its
 *    deterministic `people` are used — its narrative is not shown here;
 *  - low scores — `GET /v1/insights/activity?date=` (`activity:view`), the complete roster;
 *  - agents not reporting — `GET /v1/fleet` (`agents:view`), **today only**: it is a "right now"
 *    fact, and putting it beside a past day's figures would mix two windows on one panel — the
 *    exact defect this panel exists to remove.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { todayIso } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkdays } from "@/hooks/use-working-hours";
import { useAuthStore } from "@/stores/auth.store";
import { listFleet } from "@/modules/agents/services/fleet.service";
import {
  getScreenshots,
  type AttentionRow,
  type PersonScore,
  type ShotRow,
} from "./services/insights.service";
import { attentionFor, orgActivityFor } from "./lib/day-reads";
import {
  countOpenFlags,
  silentDevices,
  startOfLocalDay,
  type FlagCount,
  type SilentDevice,
} from "./lib/attention";
import { lastWorkdayBefore } from "./lib/week";

export type Signal<T> =
  /** Not in the viewer's role — the panel leaves it out. */
  | { status: "off" }
  | { status: "loading" }
  | { status: "error"; message: string; denied: boolean }
  | { status: "ready"; data: T };

export interface FlagSignal extends FlagCount {
  /** Every frame in the day (the server's exact count), or `null` when it didn't say. */
  total: number | null;
  /** The read stopped at its budget with more of the day unread — the count is a floor. */
  truncated: boolean;
}

export interface AgentSignal {
  silent: SilentDevice[];
  /** The workday a device must have reported on (or since) not to count as silent. */
  sinceDay: string;
}

export interface AttentionState {
  flags: Signal<FlagSignal>;
  alerts: Signal<AttentionRow[]>;
  people: Signal<PersonScore[]>;
  agents: Signal<AgentSignal>;
  reload: () => void;
}

/**
 * Frames read for the review count: 6 pages of 200. It is the Screenshots tab's own read (same
 * route, same partition), so the number here is the number that link opens on — but a day larger
 * than this is counted as "at least", never extrapolated. A server-side count is the real fix; it
 * is listed in the audit report.
 */
const FLAG_PAGE = 200;
const FLAG_MAX_PAGES = 6;

function errorOf(e: unknown, what: string): Signal<never> {
  const denied = e instanceof ApiError && e.status === 403;
  return {
    status: "error",
    denied,
    message: denied
      ? `${what} isn't available to you — your role, or your organization's plan or settings, don't include it.`
      : friendlyError(e, `Couldn't load ${what.toLowerCase()}.`),
  };
}

/** One signal's lifecycle. `load` receives a liveness check so a paged read can stop early. */
function useSignal<T>(
  enabled: boolean,
  key: string,
  what: string,
  load: (live: () => boolean) => Promise<T>,
): Signal<T> {
  const [state, setState] = useState<Signal<T>>(enabled ? { status: "loading" } : { status: "off" });
  useEffect(() => {
    if (!enabled) {
      setState({ status: "off" });
      return;
    }
    if (!key) {
      setState({ status: "loading" });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    load(() => live)
      .then((data) => live && setState({ status: "ready", data }))
      .catch((e) => live && setState(errorOf(e, what)));
    return () => {
      live = false;
    };
    // `load` is a fresh closure every render; `key` already carries everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
  return state;
}

/** Everything that needs attention on `date` (`YYYY-MM-DD`). An empty `date` reads nothing yet. */
export function useAttention(date: string): AttentionState {
  const { can } = usePermissions();
  const workdays = useWorkdays();
  const scope = useAuthStore((s) => s.user?.id ?? "");
  const [nonce, setNonce] = useState(0);
  /** The load a Refresh asked for — only that one bypasses the shared read. */
  const [freshKey, setFreshKey] = useState("");
  const reload = useCallback(() => {
    setNonce(nonce + 1);
    setFreshKey(`${date}|${nonce + 1}`);
  }, [date, nonce]);
  const key = date ? `${date}|${nonce}` : "";
  // A Refresh must reach the server, not the shared read the rest of the page made a moment ago.
  const fresh = key !== "" && key === freshKey;
  const isToday = date !== "" && date === todayIso();
  const sinceDay = isToday ? lastWorkdayBefore(date, workdays) : "";

  const flags = useSignal<FlagSignal>(
    can("screenshots:view"),
    key,
    "Screenshots",
    async (live) => {
      const shots: ShotRow[] = [];
      let cursor: string | undefined;
      let total: number | null = null;
      let pages = 0;
      // Sequential: parallel pages against this route are the burst that trips the 503 throttle.
      do {
        const grid = await getScreenshots(date, { cursor, limit: FLAG_PAGE });
        if (pages === 0) total = grid.total ?? null;
        shots.push(...grid.shots);
        cursor = grid.cursor;
        pages += 1;
      } while (cursor && pages < FLAG_MAX_PAGES && live());
      return { ...countOpenFlags(shots), total, truncated: Boolean(cursor) };
    },
  );

  const alerts = useSignal<AttentionRow[]>(
    can("ai:view") && can("anomalies:view"),
    key,
    "Alerts",
    () => attentionFor(scope, date, fresh).then((r) => r.people),
  );

  const people = useSignal<PersonScore[]>(
    can("activity:view"),
    key,
    "Scores",
    () => orgActivityFor(scope, date, fresh).then((r) => r.people),
  );

  const agents = useSignal<AgentSignal>(
    can("agents:view") && isToday,
    // Keyed on the cut-off too: it moves when the org's schedule arrives.
    key ? `${key}|${sinceDay}` : "",
    "Device status",
    () =>
      listFleet().then((f) => ({
        silent: silentDevices(f.devices, startOfLocalDay(sinceDay)),
        sinceDay,
      })),
  );

  return { flags, alerts, people, agents, reload };
}
