"use client";

import { useEffect, useState } from "react";
import { today, type CalendarDay } from "./lib/calendar";

const sameDay = (a: CalendarDay, b: CalendarDay) =>
  a.year === b.year && a.month === b.month && a.day === b.day;

/**
 * Today's local date, **re-read when the day turns over** — at local midnight, and whenever the tab
 * comes back into view (a background tab's timers are throttled, so the midnight timeout can fire
 * late or not at all while hidden).
 *
 * The object is stable for the whole day, so it is safe in memo and effect dependency lists: they
 * re-run once at midnight, never on every render. This replaces a module-level `TODAY` constant that
 * kept the day the page was loaded on forever (QA audit 2026-10-08, WP-258).
 */
export function useToday(): CalendarDay {
  const [now, setNow] = useState<CalendarDay>(today);

  useEffect(() => {
    const refresh = () =>
      setNow((prev) => {
        const t = today();
        return sameDay(prev, t) ? prev : t;
      });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const n = new Date();
      // One second past the next local midnight, so the read lands on the new day.
      const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next.getTime() - n.getTime());
    };
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Catch a day that turned over between the first render and this effect.
    refresh();
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}

/** `{year, month0, day}` → `YYYY-MM-DD`. */
export function isoOfDay(d: CalendarDay): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.year}-${p(d.month + 1)}-${p(d.day)}`;
}
