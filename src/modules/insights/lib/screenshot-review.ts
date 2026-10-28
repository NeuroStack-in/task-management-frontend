/**
 * Words for the screenshot viewer's AI review when a run produced nothing (AI audit 2026-10-22,
 * AI-57).
 *
 * `POST /v1/insights/screenshots/reports` explains a run that did nothing in `reason` — a sentence
 * written for logs, not people. The viewer pasted it in raw: "Couldn't analyze this frame —
 * monitoring.screenshots is not in this org's plan." (an internal feature key, and "frame" where the
 * glossary says "screenshot"). Each known reason now maps to a sentence a reviewer can act on; an
 * unknown one gets a plain fallback rather than the server's text, so a new server reason can never
 * leak an internal key onto the page.
 *
 * The reasons are matched on stable fragments of `insights` `vision_map::data::run` (2026-10-28),
 * plus the AI-insights gate the AI-19 fix adds there.
 */
import type { ScreenshotReportRun } from "../services/insights.service";

const FALLBACK = "Couldn't review this screenshot with AI. Try again in a moment.";

/** The sentence to show when a run left this screenshot without an AI review. */
export function reviewRunMessage(
  run: Pick<ScreenshotReportRun, "reason" | "withheld_by_privacy">,
): string {
  if ((run.withheld_by_privacy ?? 0) > 0) {
    return "This screenshot is withheld by your privacy settings, so it isn't sent for AI review.";
  }
  const r = (run.reason ?? "").toLowerCase();
  if (!r) return FALLBACK;
  if (r.includes("ai insights") || r.includes("ai.insights")) {
    return "AI review is off because AI insights is turned off in Settings → Features.";
  }
  if (/\bplan\b/.test(r)) {
    return "Screenshots aren't included in your plan, so there is nothing to review.";
  }
  if (r.includes("isn't in this day's captures") || r.includes("no screenshots captured")) {
    return "This screenshot is no longer in this day's captures. Reload the page.";
  }
  if (r.includes("already has a report")) {
    return "This screenshot already has an AI review. Reload the page to see it.";
  }
  if (r.includes("not configured")) {
    return "AI review isn't available right now. Try again later.";
  }
  if (r.includes("didn't answer")) {
    return "The AI service didn't answer. Try again in a moment.";
  }
  if (/\b(cap|capped|limit)\b/.test(r)) {
    return "Today's AI review limit has been reached. Reviews carry on tomorrow.";
  }
  return FALLBACK;
}

/**
 * What a screenshot's rating was judged against, when it wasn't the full department and job title
 * (AI audit 2026-10-22, AI-65 / AI-47). `null` for the normal case, and for a value this build doesn't
 * know — an unknown server value must degrade to saying nothing, never to a wrong sentence.
 */
const ROLE_BASIS_NOTE: Record<string, string> = {
  department: "Judged against their department only: no job title is set.",
  title: "Judged against their job title only: no department is set.",
  default: "Judged against a general role: no department or job title is set.",
};

export function roleBasisNote(basis: string | undefined | null): string | null {
  if (!basis || basis === "department+title") return null;
  return Object.prototype.hasOwnProperty.call(ROLE_BASIS_NOTE, basis) ? ROLE_BASIS_NOTE[basis] : null;
}

/**
 * How many analysed screenshots the AI could actually judge (AI-47). `not_judged` — blank, locked or
 * unreadable — counts neither way, and `on_task_pct` is a share of this number. An older server sends
 * no `not_judged`, and judged every frame.
 */
export function judgedCount(m: { frames: number; not_judged?: number }): number {
  return Math.max(0, m.frames - Math.max(0, m.not_judged ?? 0));
}
