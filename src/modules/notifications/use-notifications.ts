"use client";

/**
 * Loads the real notification feed into the shared store, keeps it fresh by polling, and makes
 * "mark read" actually persist.
 *
 * The store is shared by the navbar bell and the Notification Center, so this hook is the single
 * place either of them talks to the server. Mounting it twice is fine and expected — the fetch is
 * guarded so the two consumers don't double-load, and the poll loop is ref-counted so there is
 * exactly one timer regardless of how many components mount the hook.
 *
 * **Freshness by polling** (backend HLD §3 — there is no WebSocket): the feed refreshes on a ~30s
 * cadence *while the tab is visible*, and immediately when the tab/window regains focus or the bell
 * is opened. A hidden tab doesn't poll. This mirrors the backend's polling design and means a
 * notification created after page load (a teammate approves leave, a support reply lands) shows up
 * without a manual refresh.
 */
import { useCallback, useEffect, useState } from "react";
import { useNotificationStore } from "@/stores/notification.store";
import * as api from "./services/notifications.service";

/** Module-scoped so the bell and the Center don't both fetch when rendered together. */
let inFlight: Promise<void> | null = null;
let loadedOnce = false;
/**
 * >0 while an optimistic mark-read is still persisting. Background refreshes pause during that
 * window so a poll that races the write can't momentarily revert the read dot to unread.
 */
let pendingWrites = 0;

/** Poll cadence while the tab is visible. Matches the backend's ~30s freshness guidance. */
const POLL_MS = 30_000;
/** One shared timer across all mounts, ref-counted so it stops when the last consumer unmounts. */
let pollSubscribers = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
/** The push-rail connection (lazy, singleton) — torn down with the last subscriber. */
let stopPush: (() => void) | null = null;

/** Fetch the feed and seed the store — shared by the initial load and every refresh. */
async function fetchInto(): Promise<void> {
  const { items } = await api.listNotifications();
  useNotificationStore.getState().seed(items);
  loadedOnce = true;
}

/**
 * A silent background refresh: no loading state, errors swallowed (keep the last-known feed rather
 * than blanking the bell). Skips while the tab is hidden or a write is mid-flight.
 */
export async function refreshNotifications(): Promise<void> {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  if (inFlight || pendingWrites > 0) return;
  inFlight = fetchInto();
  try {
    await inFlight;
  } catch {
    // A failed poll is a non-event: the last-known feed stays on screen.
  } finally {
    inFlight = null;
  }
}

export interface NotificationsFeed {
  loading: boolean;
  /** Non-null when the feed couldn't be loaded. The bell stays silent rather than showing a lie. */
  error: string | null;
  reload: () => void;
  /** Silent refetch (no loading flicker) — e.g. when the bell is opened. */
  refresh: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function useNotifications(): NotificationsFeed {
  const [loading, setLoading] = useState(!loadedOnce);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (!force && loadedOnce) {
      setLoading(false);
      return;
    }
    if (!inFlight || force) {
      inFlight = fetchInto();
    }
    setLoading(true);
    setError(null);
    try {
      await inFlight;
    } catch {
      // An empty bell is the honest failure: showing demo notifications on a real account would
      // invent events that never happened.
      setError("Couldn't load notifications.");
    } finally {
      inFlight = null;
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void load(false);
  }, [load]);

  // Background freshness: one shared poll while visible, plus an immediate refetch when the
  // tab/window regains focus. The hidden-tab guard lives in refreshNotifications().
  // The MQTT push rail rides on top as a doorbell (lib/push.ts): a pushed message just triggers
  // the same refresh — polls remain the source of truth, push only shortens the wait. Best-effort:
  // if the rail can't connect, this hook behaves exactly as it did before push existed.
  useEffect(() => {
    pollSubscribers += 1;
    if (!pollTimer) {
      pollTimer = setInterval(() => void refreshNotifications(), POLL_MS);
    }
    if (!stopPush) {
      import("@/lib/push")
        .then(({ startPush }) => {
          if (pollSubscribers > 0 && !stopPush) {
            stopPush = startPush(() => void refreshNotifications());
          }
        })
        .catch(() => {});
    }
    const onFocus = () => void refreshNotifications();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      pollSubscribers -= 1;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (pollSubscribers === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        stopPush?.();
        stopPush = null;
      }
    };
  }, []);

  const reload = useCallback(() => void load(true), [load]);
  const refresh = useCallback(() => void refreshNotifications(), []);

  /**
   * Optimistic, then reconciled. The dot clearing instantly is the whole point of the interaction,
   * but a failed write must not leave the UI claiming a read that the server never recorded — so a
   * failure re-reads rather than guessing at a rollback. `pendingWrites` is decremented before the
   * reconcile so the reload isn't blocked by its own write.
   */
  const markRead = useCallback(
    (id: string) => {
      useNotificationStore.getState().markRead(id);
      pendingWrites += 1;
      api.markRead(id).then(
        () => {
          pendingWrites -= 1;
        },
        () => {
          pendingWrites -= 1;
          void load(true);
        },
      );
    },
    [load],
  );

  const markAllRead = useCallback(() => {
    useNotificationStore.getState().markAllRead();
    pendingWrites += 1;
    api.markAllRead().then(
      () => {
        pendingWrites -= 1;
      },
      () => {
        pendingWrites -= 1;
        void load(true);
      },
    );
  }, [load]);

  return { loading, error, reload, refresh, markRead, markAllRead };
}
