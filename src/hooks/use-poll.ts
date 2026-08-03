"use client";

import { useEffect, useRef } from "react";

/**
 * Run `fn` on an interval while the tab is visible — the app's **one** polling primitive.
 *
 * Freshness on WorkPulse is polling, not push (HLD §3: the WebSocket is deferred, and it couldn't
 * beat the agent's 300 s batch anyway). The rule from that decision: **never a `setInterval` + fetch
 * inside a component** — put it behind one abstraction, so if push ever lands, that swap touches this
 * hook and nothing else. This is that hook.
 *
 * - **Paused when hidden.** No polling against a backgrounded tab (Page Visibility API) — it wastes
 *   requests and battery, and the answer is stale the moment you look away.
 * - **Refetches on return.** Coming back to the tab fires `fn` immediately, then resumes the interval,
 *   so a tab you left an hour ago is fresh the instant you focus it — not one interval later.
 * - **Latest `fn` always used.** Kept in a ref, so a changing closure doesn't reset the timer.
 *
 * `fn` should be a **background** refresh — one that updates state without flashing a loading spinner.
 * A poll that blanks the screen every interval is worse than no poll.
 */
export function usePoll(fn: () => void, intervalMs: number | null) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    // `null` (or a non-positive interval) disables polling outright — including the
    // refetch-on-return listener, which would otherwise still fire for a caller that asked for no
    // polling at all. Callers use this for data that cannot change, e.g. a past day's timesheet.
    if (intervalMs === null || intervalMs <= 0) return;
    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id === undefined) id = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      if (id !== undefined) {
        clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        fnRef.current(); // fresh the moment you return, before the next tick
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
