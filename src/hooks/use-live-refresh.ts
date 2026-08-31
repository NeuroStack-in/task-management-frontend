"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePoll } from "@/hooks/use-poll";
import { formatDuration } from "@/lib/format";

/** How often a live surface re-fetches. */
export const LIVE_REFRESH_MS = 30_000;

/**
 * The **refresh half** of a live data hook: a nonce for the fetching effect to key on, plus the
 * distinction between a foreground reload and a background poll.
 *
 * Nearly every data hook here already had the nonce-and-`reload()` shape, and every one of them
 * called `setLoading(true)` on the way in. That is right for a user pressing Retry and wrong for a
 * 30-second poll — {@link usePoll}'s own contract says its callback must be a background refresh,
 * because "a poll that blanks the screen every interval is worse than no poll". With nowhere to
 * carry that distinction, adding polling to these hooks would have flashed a spinner on every live
 * surface twice a minute.
 *
 * So `reload()` is the visible one, `refresh()` is the quiet one, and `isBackground()` tells the
 * effect which it is. Reading it **clears** the flag, so it cannot leak into the next run.
 *
 * ```ts
 * const { nonce, reload, isBackground } = useLiveRefresh();
 * useEffect(() => {
 *   if (!isBackground()) setLoading(true);
 *   …fetch…
 * }, [nonce, …]);
 * ```
 *
 * Polling inherits what {@link usePoll} already guarantees: paused while the tab is hidden, an
 * immediate re-fetch on return, and one cadence defined in one place.
 *
 * **What this cannot make fresher.** The desktop agent uploads on a **300 s** batch cycle, so
 * someone else's tracked time is at best ~5 minutes old however fast this polls — the ceiling is the
 * agent's, not the UI's. Polling faster spends requests on an answer that has not changed. A
 * *running* session is the exception: it ticks locally via {@link useRunningSeconds} rather than
 * being fetched.
 */
export function useLiveRefresh(intervalMs: number | null = LIVE_REFRESH_MS) {
  const [nonce, setNonce] = useState(0);
  const backgroundRef = useRef(false);

  /** A visible reload — Retry buttons, filter changes. Shows the loading state. */
  const reload = useCallback(() => {
    backgroundRef.current = false;
    setNonce((n) => n + 1);
  }, []);

  /** A quiet re-fetch — the poll. Updates state in place, no spinner. */
  const refresh = useCallback(() => {
    backgroundRef.current = true;
    setNonce((n) => n + 1);
  }, []);

  /** True when this run came from `refresh()`. Reading it clears the flag. */
  const isBackground = useCallback(() => {
    const bg = backgroundRef.current;
    backgroundRef.current = false;
    return bg;
  }, []);

  usePoll(refresh, intervalMs);

  return { nonce, reload, refresh, isBackground };
}

/**
 * Seconds elapsed for a session that is **still running**, recomputed once a second.
 *
 * Polling alone leaves a running timer frozen at whatever the last fetch said: the row sits still
 * for up to 30 seconds, then jumps. This is the display half — it derives elapsed time from the
 * session's own start stamp and a 1 Hz re-render, so the number climbs smoothly between fetches
 * without asking the server anything.
 *
 * **Derived from `startMs`, never incremented.** A counter drifts when the tab is throttled or the
 * machine sleeps, and would then disagree with the server's own total at the next poll. Recomputing
 * from the start stamp is self-correcting: however long the tab was frozen, the next tick is right.
 *
 * `startMs === null` means nothing is running — no interval is started at all.
 */
export function useRunningSeconds(startMs: number | null): number {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (startMs === null) {
      setNow(null);
      return;
    }
    // Set immediately so the first paint after mount is correct rather than a second behind.
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);

  if (startMs === null || now === null) return 0;
  return Math.max(0, Math.floor((now - startMs) / 1000));
}

/**
 * Seconds → `HH:MM:SS`. Kept as a name because callers import it from here; the implementation is
 * `lib/format`'s, which every other duration in the product also goes through.
 *
 * It used to render `H:MM`, on the reasoning that a timesheet cell wants clock time rather than a
 * rounded decimal. That half was right — the rounding it avoided is how a minute goes missing in a
 * column people reconcile against payroll. What it got wrong was inventing a *third* notation to do
 * it in: `1:50` beside a running `2:28:05` and a `2.5h` total read as three different numbers.
 */
export const formatHMS = formatDuration;
