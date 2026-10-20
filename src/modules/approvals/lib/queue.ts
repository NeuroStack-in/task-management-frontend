/**
 * The approval queue's reading aids, kept pure so they can be tested without a page (UX audit
 * 2026-10-16, TIME-10): what order to show requests in, how soon each starts, who else is off on the
 * same dates, what the balance will be after approving, and what a failed decision means.
 *
 * Nothing here decides anything. The server re-checks balance and overlap on every decision; these
 * only let the approver see the answer before pressing the button instead of after.
 */
import { ApiError } from "@/lib/api";

/** The fields these helpers read off a queue item. */
export interface QueueLike {
  requestId: string;
  userId: string;
  status: string;
  /** Inclusive `YYYY-MM-DD`. */
  from: string;
  to: string;
  createdAt?: number;
}

/**
 * Pending requests first, **soonest start first** — the one that starts tomorrow is the one to decide
 * now; the queue used to be newest-submitted first, which buried it under requests for next quarter.
 * Ties go to whoever asked first. Decided requests follow, most recent start first: that part is
 * history, and history reads newest-first.
 */
export function sortQueue<T extends QueueLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ap = a.status === "pending";
    const bp = b.status === "pending";
    if (ap !== bp) return ap ? -1 : 1;
    if (ap) {
      return (
        a.from.localeCompare(b.from) ||
        (a.createdAt ?? 0) - (b.createdAt ?? 0) ||
        a.requestId.localeCompare(b.requestId)
      );
    }
    return b.from.localeCompare(a.from) || (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

/** Whole days from `today` to `iso` (both `YYYY-MM-DD`), or `null` for an unreadable date. */
export function daysUntil(iso: string, today: string): number | null {
  const day = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000 : null;
  };
  const a = day(iso);
  const t = day(today);
  return a === null || t === null ? null : a - t;
}

/** "Starts today", "Starts tomorrow", "Starts in 5 days", "Started 2 days ago". */
export function startsLabel(from: string, today: string): string | null {
  const n = daysUntil(from, today);
  if (n === null) return null;
  if (n === 0) return "Starts today";
  if (n === 1) return "Starts tomorrow";
  if (n > 1) return `Starts in ${n} days`;
  return n === -1 ? "Started yesterday" : `Started ${-n} days ago`;
}

/** Do two inclusive date ranges share at least one day? */
export function rangesOverlap(
  a: { from: string; to: string },
  b: { from: string; to: string },
): boolean {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * Everyone **else** who is off on any of `item`'s dates — approved, or still waiting in the queue —
 * soonest first. Rejected and cancelled requests are not time off, and the requester's own other
 * requests are a balance question, not cover.
 */
export function alsoOff<T extends QueueLike>(item: QueueLike, all: T[]): T[] {
  return all
    .filter(
      (o) =>
        o.userId !== item.userId &&
        o.requestId !== item.requestId &&
        (o.status === "approved" || o.status === "pending") &&
        rangesOverlap(o, item),
    )
    .sort((a, b) => a.from.localeCompare(b.from) || a.userId.localeCompare(b.userId));
}

/** One year's standing for one person and type — the figures the server's balance check reads. */
export interface Standing {
  allowance: number;
  used: number;
}

/** What approving a request does to one year's balance. */
export interface BalanceAfter {
  year: string;
  /** This request's share of that year. */
  share: number;
  /** `0` = no fixed allowance: nothing comes off a quota, and approval never fails on balance. */
  allowance: number;
  /** Left before approving. */
  left: number;
  /** Left after approving this one. */
  after: number;
  /** Days of the same type this person has waiting in other pending requests, that year. */
  otherPending: number;
  /** The server would refuse: `allowance − used < share` (`balance_allows`). */
  over: boolean;
}

/**
 * The balance before and after approving, per calendar year the request touches. `null` for a year
 * whose standing isn't known — the server still checks, and the page says it can't show it.
 */
export function balanceAfter(
  portions: [string, number][],
  standing: (year: string) => Standing | null,
  otherPending: (year: string) => number,
): (BalanceAfter | null)[] {
  return portions.map(([year, share]) => {
    const s = standing(year);
    if (!s) return null;
    const left = s.allowance - s.used;
    return {
      year,
      share,
      allowance: s.allowance,
      left,
      after: left - share,
      otherPending: otherPending(year),
      // The server's own comparison: a zero allowance never runs short.
      over: s.allowance > 0 && !(left >= share),
    };
  });
}

/** What a failed approve/reject means, and what to do about it — one sentence pair, not "try again". */
export function decisionError(
  e: unknown,
  who: { requesterName: string; typeName: string },
): { title: string; description: string; stale: boolean } {
  const code = e instanceof ApiError ? `${e.code ?? ""} ${e.serverMessage ?? ""}` : "";
  if (code.includes("insufficient_balance")) {
    return {
      title: "Not enough leave balance to approve this",
      description: `${who.requesterName} doesn't have enough ${who.typeName} left. Reject it, or adjust their allowance first.`,
      stale: false,
    };
  }
  if (code.includes("cannot_approve_own_request")) {
    return {
      title: "You can't approve your own leave",
      description: "Ask another approver to decide it.",
      stale: false,
    };
  }
  if (code.includes("overlapping_leave")) {
    return {
      title: "This overlaps leave that's already approved",
      description: "Reject it, or cancel the other request first.",
      stale: false,
    };
  }
  if (e instanceof ApiError && e.status === 409) {
    return {
      title: "This request was already decided or withdrawn",
      description: "The queue has been refreshed.",
      stale: true,
    };
  }
  return {
    title: "Couldn't record the decision.",
    description:
      e instanceof ApiError ? e.message : "Check your connection and try again.",
    stale: false,
  };
}
