"use client";

/**
 * Loads the real notification feed into the shared store, and makes "mark read" actually persist.
 *
 * The store is shared by the navbar bell and the Notification Center, so this hook is the single
 * place either of them talks to the server. Mounting it twice is fine and expected — the fetch is
 * guarded so the two consumers don't double-load on the same page.
 *
 * ## Polling
 *
 * The feed re-fetches every 60s while the tab is visible and pauses when it isn't (see
 * `POLL_INTERVAL_MS`). Before this, the bell fetched once on mount and never again — a notification
 * raised while you sat on a page simply never appeared, which is the one thing a bell must not do.
 * 60s rather than the 30s default because a notification arriving a minute late is unremarkable,
 * and this fires for every signed-in tab.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotificationStore } from "@/stores/notification.store";
import * as api from "./services/notifications.service";

/** Module-scoped so the bell and the Center don't both fetch when rendered together. */
let inFlight: Promise<void> | null = null;
let loadedOnce = false;

const POLL_INTERVAL_MS = 60_000;

export interface NotificationsFeed {
  loading: boolean;
  /** Non-null when the feed couldn't be loaded. The bell stays silent rather than showing a lie. */
  error: string | null;
  reload: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function useNotifications(): NotificationsFeed {
  const seed = useNotificationStore((s) => s.seed);
  const [loading, setLoading] = useState(!loadedOnce);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      if (!force && loadedOnce) {
        setLoading(false);
        return;
      }
      if (!inFlight || force) {
        inFlight = (async () => {
          const { items } = await api.listNotifications();
          seed(items);
          loadedOnce = true;
        })();
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
    },
    [seed],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // Keep the bell current. Paused while the tab is hidden, and caught up immediately on return —
  // a backgrounded tab polling a Lambda-backed API is pure cost for data nobody is looking at.
  // `pollRef` holds the latest `load` so the interval isn't torn down and recreated on every render.
  const pollRef = useRef(load);
  pollRef.current = load;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => void pollRef.current(true), POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void pollRef.current(true);
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
  }, []);

  const reload = useCallback(() => void load(true), [load]);

  /**
   * Optimistic, then reconciled. The dot clearing instantly is the whole point of the interaction,
   * but a failed write must not leave the UI claiming a read that the server never recorded — so a
   * failure re-reads rather than guessing at a rollback.
   */
  const markRead = useCallback(
    (id: string) => {
      useNotificationStore.getState().markRead(id);
      api.markRead(id).catch(() => void load(true));
    },
    [load],
  );

  const markAllRead = useCallback(() => {
    useNotificationStore.getState().markAllRead();
    api.markAllRead().catch(() => void load(true));
  }, [load]);

  return { loading, error, reload, markRead, markAllRead };
}
