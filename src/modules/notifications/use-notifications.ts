"use client";

/**
 * Loads the real notification feed into the shared store, and makes "mark read" actually persist.
 *
 * The store is shared by the navbar bell and the Notification Center, so this hook is the single
 * place either of them talks to the server. Mounting it twice is fine and expected — the fetch is
 * guarded so the two consumers don't double-load on the same page.
 */
import { useCallback, useEffect, useState } from "react";
import { useNotificationStore } from "@/stores/notification.store";
import * as api from "./services/notifications.service";

/** Module-scoped so the bell and the Center don't both fetch when rendered together. */
let inFlight: Promise<void> | null = null;
let loadedOnce = false;

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
