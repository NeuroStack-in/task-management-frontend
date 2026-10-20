import { REVIEW_TIME } from "@/modules/onboarding/review-time";

/**
 * The brand panel's promise on every sign-up screen — the request form and, at /onboarding, the
 * waiting screen (UX audit 2026-10-16, PUB-03). It said "have time and attendance running the same
 * afternoon", but every new workspace now waits for WorkPulse staff to approve it (owner decision
 * 2026-10-17), reviewed within one business day. Server-safe: plain data.
 */
export const SIGNUP_PANEL = {
  headline: "Set your organization",
  headlineAccent: "in motion",
  copy: `Free during the beta, no card required. Tell us about your organization — ${REVIEW_TIME.charAt(0).toLowerCase()}${REVIEW_TIME.slice(1)} Once it's approved, invite your team and start tracking.`,
};
