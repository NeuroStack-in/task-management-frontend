"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { getScreenshots, type ShotRow } from "./services/insights.service";

const PAGE_SIZE = 60;

export interface ScreenshotsState {
  /**
   * All shots loaded so far for the current (date, userId), across pages, in the server's order:
   * **person-then-time** (newest first within a person) for the org-wide day, newest first for one
   * person. Not a timeline of the org's day — group or sort before treating it as one.
   */
  shots: ShotRow[];
  /**
   * Epoch ms the current first page arrived, `0` before then. Its presigned image URLs expire 15
   * minutes after issue, so a caller can tell a broken image on an old list from a missing one.
   */
  loadedAt: number;
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
 * follows the server cursor and appends. The index is sorted person-then-time, so an org-wide read
 * arrives one person at a time — see {@link ScreenshotsState.shots}. **Real, monitoring-fed:** empty
 * until the desktop agent captures.
 */
export function useScreenshots(date: string, userId?: string): ScreenshotsState {
  const [shots, setShots] = useState<ShotRow[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Guards a stale in-flight response from committing after the query changed.
  const runId = useRef(0);
  /** The (date, user) the current list belongs to — a reload of the same one keeps it on screen. */
  const loadedFor = useRef<string | null>(null);
  /**
   * A next-page read is in flight. State alone can't guard it: the auto-pager and the viewer's
   * "load as you walk" (UX audit MON-12) can both call `loadMore` in one commit, before
   * `loadingMore` re-renders, and the same page would be fetched — and appended — twice.
   */
  const pageInFlight = useRef(false);

  // First page — resets whenever the query (date/userId) or reload nonce changes.
  useEffect(() => {
    if (!date) return;
    const id = ++runId.current;
    const key = `${date}|${userId ?? ""}`;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    // A **new** query starts empty. A reload of the same one keeps what is on screen until the new
    // first page arrives: clearing it made the employee view flash "0 captures … No captures in this
    // range" on every refresh — every six seconds while Capture-now waited (WP-080).
    if (loadedFor.current !== key) {
      setShots([]);
      loadedFor.current = key;
    }
    setCursor(undefined);
    getScreenshots(date, { userId, limit: PAGE_SIZE })
      .then((g) => {
        if (runId.current !== id) return;
        setShots(g.shots);
        setCursor(g.cursor);
        setLoadedAt(Date.now());
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
    if (!date || !cursor || loading || loadingMore || pageInFlight.current) return;
    const id = runId.current; // stay bound to the current query
    pageInFlight.current = true;
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
        pageInFlight.current = false;
        if (runId.current === id) setLoadingMore(false);
      });
  }, [date, userId, cursor, loading, loadingMore]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    shots,
    loadedAt,
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
