"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { listFleet, type ApiFleet } from "./services/fleet.service";

export interface FleetState {
  fleet: ApiFleet | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * The org's devices, **kept current**: a quiet re-fetch every 30 s while the tab is visible, and one
 * the moment it becomes visible again. The list was read once and never again, so a device that went
 * offline an hour earlier still read "Online" under a header promising live connectivity (QA audit
 * 2026-10-08, WP-241). A failed background poll keeps the last list rather than replacing it with an
 * error; Refresh and Retry are the visible reload.
 */
export function useFleet(): FleetState {
  const [fleet, setFleet] = useState<ApiFleet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { nonce, reload, isBackground } = useLiveRefresh();
  /** A list has been shown — only then may a failed background poll stay quiet. */
  const haveList = useRef(false);

  useEffect(() => {
    let live = true;
    const background = isBackground();
    if (!background) {
      setLoading(true);
      setError(null);
    }
    listFleet()
      .then((f) => {
        if (!live) return;
        haveList.current = true;
        setFleet(f);
        setError(null);
      })
      .catch((e) => {
        if (live && (!background || !haveList.current)) setError(messageOf(e));
      })
      .finally(() => {
        // Also after a poll: it may have superseded a visible reload whose own `finally` is skipped.
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce, isBackground]);

  return { fleet, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the device fleet.";
    return e.message;
  }
  return "Couldn't load the device fleet. Check your connection and retry.";
}
