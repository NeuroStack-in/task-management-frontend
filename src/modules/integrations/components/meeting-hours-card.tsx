"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { getCalendarSummary } from "@/modules/integrations/services/integrations.service";
import { localDateOf } from "@/lib/local-day";

/**
 * "In meetings today" — the payoff of the Google Calendar integration, on the personal dashboard.
 *
 * The desktop agent reads a meeting as idle time (it only sees keyboard/mouse). This card is the
 * honest counterweight: it surfaces, from the user's own free/busy data, how much of the day was
 * actually booked — so a low active-time number has context rather than looking like slacking off.
 *
 * **Renders nothing unless the caller has their own calendar connected.** It fetches its own
 * summary and returns null when `connected` is false, so the KPI strip stays clean for everyone who
 * hasn't linked a calendar — the card simply appears once they do (via Settings → Integrations).
 *
 * Deliberately *not* an idle-relabel on an activity timeline: no intraday timeline exists (the
 * scorer stores daily totals only — see `docs/INTEGRATIONS.md` §8.1). A daily meeting-hours figure
 * is the honest thing the stored data can support.
 */
export function MeetingHoursCard() {
  const [hours, setHours] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Local "today" — the card is a same-day glance, so it must agree with the viewer's calendar.
    // This used to say `toISOString()`, which is UTC: east of Greenwich the tile showed YESTERDAY's
    // meeting hours for the first hours of every day, under a heading that said today. The comment
    // already claimed "local"; only the code disagreed.
    const today = localDateOf(Date.now());
    let live = true;
    getCalendarSummary(today, today)
      .then((s) => {
        if (!live) return;
        setShow(s.connected);
        setHours(s.total_sec / 3600);
      })
      .catch(() => {
        // A failed fetch (not connected → the endpoint still answers with connected:false, but a
        // transient error too) simply hides the card rather than showing a broken tile.
        if (live) setShow(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;

  return (
    <StatCard
      label="In meetings today"
      value={hours === null ? "—" : `${hours.toFixed(1)}h`}
      icon={CalendarClock}
      hint="from Google Calendar"
      href="/settings/integrations"
    />
  );
}
