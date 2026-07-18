"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { getScreenshots, type ShotRow } from "./services/insights.service";

const PAGE_SIZE = 60;

export interface ScreenshotsState {
  /** All shots loaded so far for the current (date, userId), time-ordered, across pages. */
  shots: ShotRow[];
  /** Initial-page load (no shots on screen yet). */
  loading: boolean;
  /** A "Load more" page fetch is in flight (shots already on screen). */
  loadingMore: boolean;
  error: string | null;
  /** A cursor is present ⇒ another page exists. */
  hasMore: boolean;
  /** Fetch and append the next page. No-op while a fetch is in flight or when exhausted. */
  loadMore: () => void;
  /** Re-fetch from the first page. */
  reload: () => void;
}

/**
 * Loads the pii-gated screenshot grid for a day (`GET /v1/insights/screenshots`, LLD §14).
 * Empty `date` skips the fetch. Changing `date` or `userId` resets to page 1; `loadMore`
 * follows the server cursor and appends. Shots arrive time-ordered, so the accumulated list
 * doubles as the day's timeline. **Real, monitoring-fed:** empty until the desktop agent captures.
 */
export function useScreenshots(date: string, userId?: string): ScreenshotsState {
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Guards a stale in-flight response from committing after the query changed.
  const runId = useRef(0);

  // First page — resets whenever the query (date/userId) or reload nonce changes.
  useEffect(() => {
    if (!date) return;
    const id = ++runId.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setShots([]);
    setCursor(undefined);
    getScreenshots(date, { userId, limit: PAGE_SIZE })
      .then((g) => {
        if (runId.current !== id) return;
        setShots(g.shots);
        setCursor(g.cursor);
      })
      .catch((e) => {
        if (runId.current !== id) return;
        setError(messageOf(e));
      })
      .finally(() => {
        if (runId.current === id) setLoading(false);
      });
  }, [date, userId, nonce]);

  const loadMore = useCallback(() => {
    if (!date || !cursor || loading || loadingMore) return;
    const id = runId.current; // stay bound to the current query
    setLoadingMore(true);
    getScreenshots(date, { userId, cursor, limit: PAGE_SIZE })
      .then((g) => {
        if (runId.current !== id) return;
        setShots((prev) => [...prev, ...g.shots]);
        setCursor(g.cursor);
      })
      .catch((e) => {
        if (runId.current !== id) return;
        setError(messageOf(e));
      })
      .finally(() => {
        if (runId.current === id) setLoadingMore(false);
      });
  }, [date, userId, cursor, loading, loadingMore]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    shots,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(cursor),
    loadMore,
    reload,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to screenshots.";
    return e.message;
  }
  return "Couldn't load screenshots. Check your connection and retry.";
}
