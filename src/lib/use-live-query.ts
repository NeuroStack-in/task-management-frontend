"use client";

/**
 * Polled reads that stay fresh without a remount.
 *
 * Every hook in this app fetches once on mount and never again, so the notification bell, the
 * approvals queue and the fleet list all go stale the moment you stop navigating. `WIRING-PLAN.md`
 * §freshness specifies this abstraction; it did not exist, and the cost of not having it grows with
 * every module wired.
 *
 * ## What it does beyond a `setInterval`
 *
 * - **Pauses when the tab is hidden.** A backgrounded tab polling every 30s is pure waste — and with
 *   Lambda behind API Gateway it is waste that costs money and can trip the `ingest` throttle.
 * - **Refetches immediately on becoming visible**, so returning to the tab shows current data rather
 *   than data from whenever you left.
 * - **Never overlaps requests.** A slow response can't stack up behind the interval.
 * - **Drops stale responses.** If a refetch resolves after a newer one, it is discarded rather than
 *   overwriting fresher data.
 * - **Keeps the previous data visible while refetching**, so a poll doesn't flash a spinner over a
 *   populated view. `loading` is true only on the first load; `refreshing` covers the rest.
 *
 * ## What it deliberately does NOT do
 *
 * No `If-None-Match`/304 handling. The plan calls for it and two routes genuinely serve weak ETags
 * (`GET /v1/fleet`, `GET /v1/agent/config`), but `apiFetch` unwraps the envelope and discards
 * headers, so a conditional request has nowhere to put the validator. Adding it means changing
 * `apiFetch`'s return shape — a wider change than this. Polling without it is correct, just chattier.
 *
 * ## Usage
 *
 *   const { data, loading, error, refresh } = useLiveQuery(listNotifications, { intervalMs: 30_000 })
 *
 * `fetcher` must be stable (module-scope function, or wrapped in `useCallback`) — it is a dependency
 * of the polling effect, so an inline arrow would restart the interval on every render.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface LiveQueryOptions {
  /** Poll cadence while the tab is visible. Default 30s, matching WIRING-PLAN. */
  intervalMs?: number;
  /** Set false to hold off (e.g. a dialog that hasn't opened, or a missing id). */
  enabled?: boolean;
}

export interface LiveQueryState<T> {
  data: T | null;
  /** True only until the first result arrives — never during a background poll. */
  loading: boolean;
  /** True during any refetch after the first, for a subtle indicator. */
  refreshing: boolean;
  error: string | null;
  /** Force an immediate refetch (e.g. after a mutation). */
  refresh: () => void;
}

const DEFAULT_INTERVAL_MS = 30_000;

export function useLiveQuery<T>(
  fetcher: () => Promise<T>,
  options: LiveQueryOptions = {},
): LiveQueryState<T> {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const inFlight = useRef(false);
  // Monotonic id: a response is applied only if no newer request started after it.
  const seq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    const mySeq = ++seq.current;

    setRefreshing(true);
    try {
      const next = await fetcher();
      if (!mounted.current || mySeq !== seq.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (!mounted.current || mySeq !== seq.current) return;
      setError(messageOf(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [fetcher, enabled]);

  // First load + polling, paused while hidden.
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void run();

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run(); // catch up immediately, then resume the cadence
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [run, enabled, intervalMs]);

  const refresh = useCallback(() => void run(), [run]);
  return { data, loading, refreshing, error, refresh };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this.";
    return e.message;
  }
  return "Couldn't reach the server. Check your connection.";
}
