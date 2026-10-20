"use client";

import { useEffect, useReducer } from "react";
import { getMyDevices, type MyDevice } from "@/modules/agents/services/my-devices.service";

/**
 * The caller's own devices (`GET /v1/me/devices`), shared by every reader on the page — the top
 * bar's download chip is mounted everywhere and the dashboard's device card beside it, so one cache
 * and one request in flight serve both (UX audit 2026-10-16, EMP-09).
 *
 * `devices` is `null` while unknown: before the first answer, on a server without the route (404),
 * and after a failed read. Readers hide device status in that case — never "not installed".
 */
interface Cache {
  at: number;
  devices: MyDevice[] | null;
}

let cache: Cache | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * An unknown answer isn't asked again for a while. A server without the route answers 404 — or, from
 * the browser's side, a CORS-blocked failure, since the gateway's 404 for an unmatched route carries
 * no CORS headers — and it won't grow the route mid-session; a genuine outage gets the same pause.
 */
const UNKNOWN_BACKOFF_MS = 10 * 60 * 1000;

function load(): Promise<void> {
  if (!inflight) {
    inflight = getMyDevices()
      .then((devices) => {
        cache = { at: Date.now(), devices };
      })
      .catch(() => {
        // A failed read is "unknown", like the 404 (see `UNKNOWN_BACKOFF_MS`).
        cache = { at: Date.now(), devices: null };
      })
      .finally(() => {
        inflight = null;
        listeners.forEach((l) => l());
      });
  }
  return inflight;
}

function isStale(refreshMs: number): boolean {
  if (!cache) return true;
  const age = Date.now() - cache.at;
  return cache.devices === null ? age > UNKNOWN_BACKOFF_MS : age > refreshMs;
}

/**
 * @param refreshMs how old an answer may get before this reader asks again (only while the tab is
 *   visible). The dashboard card wants connectivity within a minute; the top bar is happy with five.
 */
export function useMyDevices(refreshMs = 5 * 60 * 1000): {
  devices: MyDevice[] | null;
  loaded: boolean;
} {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    if (isStale(refreshMs)) void load();
    const id = setInterval(
      () => {
        if (document.visibilityState === "visible" && isStale(refreshMs)) void load();
      },
      Math.min(refreshMs, 60_000),
    );
    return () => {
      listeners.delete(rerender);
      clearInterval(id);
    };
  }, [refreshMs]);
  return { devices: cache?.devices ?? null, loaded: cache !== null };
}

/** Test hook: forget the shared answer. */
export function __resetMyDevicesCache(): void {
  cache = null;
  inflight = null;
}
