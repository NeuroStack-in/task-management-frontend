"use client";

import { useEffect, useState } from "react";

/**
 * A ticking "now" (epoch ms) for **live-updating running timers** — the read-only mirror of the
 * desktop agent's clock. A running session has a `start`/`clock_in` but no `end`, so its elapsed
 * time is `now − start`; re-reading `now` on an interval is what makes that tick on screen without a
 * refetch.
 *
 * Hydration-safe by construction: the value is only ever fed into elapsed-time math on surfaces that
 * render a loader during SSR and first paint (dashboard, attendance, timesheet — all behind
 * `AuthGuard` + a data fetch), so the server never emits a timer value to diverge from the client.
 * The first `useEffect` tick also re-stamps `now` immediately on mount.
 *
 * Default cadence is 30s — a running timer shown to a tenth of an hour (6 min) or to the minute
 * only needs to move a few times a minute, and a tighter interval just burns renders across every
 * row. Pass a smaller `intervalMs` for a seconds-level display.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
