"use client";

/**
 * Top performers / needs attention for the **ISO week** containing a given date.
 *
 * # Why this is not the daily report's own lists
 *
 * `GET /v1/insights/reports?date=` ranks a single day, and on a day when one person reported, that
 * person is simultaneously the best and the worst — which is how "Kishore M · score 58" came to sit
 * in both cards at once. A week is a wide enough window for a ranking to mean something, and it is
 * also the window a manager actually reviews.
 *
 * The weekly AI endpoint cannot supply this: `AiPeriodReport` is narrative-only, with no metrics. So
 * the week is aggregated here from the per-day org rollup (`GET /v1/insights/activity?date=`), which
 * is already the source the daily report ranks from.
 *
 * # Rules the ranking follows
 *
 * - **A person's week score is the mean of the days they were actually scored**, not of the week.
 *   Dividing by seven would punish someone for a day the agent never reported, turning a data gap
 *   into a performance figure.
 * - **Future days are never fetched.** A week containing today ends at today.
 * - **The two lists are disjoint by construction**, split on the same threshold: at or above it you
 *   are performing, below it you need attention. Taking "the top three" regardless of score is what
 *   let somebody scoring 55 be called a top performer *and* be hidden from the attention list they
 *   belonged in — so a short roster produces a short list, or none, rather than a flattering one.
 */
import { useEffect, useState } from "react";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  getOrgActivity,
  type NamedScore,
  type PersonScore,
} from "@/modules/insights/services/insights.service";

/**
 * The line between the two lists — the same cut the daily report uses.
 *
 * It is a *threshold*, not a ranking position: below it you need attention, at or above it you are
 * performing. That is what keeps the lists disjoint no matter how few people reported.
 */
const ATTENTION_BELOW = 60;
const TOP_N = 3;

export interface WeekPerformers {
  topPerformers: NamedScore[];
  needsAttention: NamedScore[];
  /** How many distinct people were scored at all this week — drives the empty-state wording. */
  scoredPeople: number;
  /** ISO dates actually fetched (past-or-today days of the week), for the caption. */
  days: string[];
  loading: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The ISO week (Mon–Sun) containing `iso`, truncated at today.
 *
 * Local dates throughout: the org rollup is keyed by the calendar day the org works in, and building
 * the range in UTC would shift the week by one for anyone east or west of it.
 */
function weekDaysThrough(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const picked = new Date(y, m - 1, d);
  // getDay(): 0 = Sunday. Shift so Monday starts the week.
  const monday = new Date(picked);
  monday.setDate(picked.getDate() - ((picked.getDay() + 6) % 7));

  const now = new Date();
  const todayIso = ymd(now);
  const out: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const isoDay = ymd(day);
    if (isoDay > todayIso) break; // a day that hasn't happened has nothing to rank
    out.push(isoDay);
  }
  return out;
}

/**
 * The ranking itself, over one entry per fetched day. Pure, so the rules can be pinned by a test
 * without standing up a week of API responses.
 */
export function rankWeek(
  daysOfPeople: PersonScore[][],
): Pick<WeekPerformers, "topPerformers" | "needsAttention" | "scoredPeople"> {
  // Name is carried per day; the latest one seen wins, so a rename mid-week shows the current name.
  const acc = new Map<string, { name: string; sum: number; days: number }>();
  for (const people of daysOfPeople) {
    for (const p of people) {
      // No breakdown = the agent never reported for them that day. A gap, never a zero — averaging
      // it in as 0 would turn a missing agent into a bad week.
      if (!p.breakdown) continue;
      const prev = acc.get(p.user_id) ?? { name: p.name, sum: 0, days: 0 };
      acc.set(p.user_id, {
        name: p.name || prev.name,
        sum: prev.sum + p.breakdown.score,
        days: prev.days + 1,
      });
    }
  }

  const ranked: NamedScore[] = [...acc.values()]
    .map((v) => ({ name: v.name, score: Math.round(v.sum / v.days) }))
    .sort((a, b) => b.score - a.score);

  // Disjoint by the threshold, so nobody can be both — the defect this replaced. An empty "top
  // performers" on a week where everyone struggled is the honest answer, not a bug.
  const topPerformers = ranked.filter((p) => p.score >= ATTENTION_BELOW).slice(0, TOP_N);
  const needsAttention = ranked
    .filter((p) => p.score < ATTENTION_BELOW)
    .slice(-TOP_N)
    .reverse();

  return { topPerformers, needsAttention, scoredPeople: ranked.length };
}

export function useWeekPerformers(date: string): WeekPerformers {
  const [state, setState] = useState<WeekPerformers>({
    topPerformers: [],
    needsAttention: [],
    scoredPeople: 0,
    days: [],
    loading: true,
  });

  useEffect(() => {
    if (!date) return;
    let live = true;
    const days = weekDaysThrough(date);
    setState((s) => ({ ...s, loading: true, days }));

    (async () => {
      // Bounded: a week is at most seven reads, but firing them all at once is the burst pattern
      // that trips the 503 throttle elsewhere in this app.
      const results = await mapWithConcurrency(days, 3, (iso) =>
        getOrgActivity(iso).then(
          (r) => r.people,
          () => [],
        ),
      );
      if (!live) return;

      setState({ ...rankWeek(results), days, loading: false });
    })();

    return () => {
      live = false;
    };
  }, [date]);

  return state;
}
