/**
 * Score thresholds — **one source** for every Analytics surface (UX audit 2026-10-16, MON-18).
 *
 * The audit found three unrelated cut-offs: "Needs attention" was a score below 60, hard-coded in two
 * places and never shown; the workforce-health ring used 50 / 65 / 80; "Top performer" had none. A
 * reader saw a team average of 62 called "Watch" while nobody on it "needed attention", with no way
 * to tell why. Every surface now reads its line from here, and shows it where it is used.
 *
 * Which of these the **server** decides, and which this app does:
 *
 *  - {@link LOW_SCORE_BELOW} — the server's own line. The executive report's `needs_attention`
 *    (`reports::data`, bottom three with a score under 60) and the attention list's weight
 *    (`attention_list::attention_weight`, zero for a score of 60+ with no anomaly) both use 60, so the
 *    hub cannot disagree with them about who is low. Change it there first.
 *  - {@link RANK_MIN_MINUTES_PER_DAY} — the server's floor for the department summary's "top
 *    performer" / lowest scorer (`dept_summary::MIN_HOURS_PER_DAY`, half an hour a day). That summary
 *    ranks on score alone above the floor — it applies no score threshold of its own, so this app
 *    labels its lowest scorer "Needs attention" only when they are under {@link LOW_SCORE_BELOW}.
 *  - The health bands — this app's. They share the 60 line, so "At risk" means what "Needs
 *    attention" means, one level up.
 */

/** Below this a productivity score needs attention (server-decided — see the module note). */
export const LOW_SCORE_BELOW = 60;

/** A team average at or above this is "Healthy". Between it and {@link LOW_SCORE_BELOW}, "Stable". */
export const HEALTHY_FROM = 80;

/** The department summary only ranks people who tracked at least this much a day (server floor). */
export const RANK_MIN_MINUTES_PER_DAY = 30;

export type HealthBandKey = "healthy" | "stable" | "at-risk";

export interface HealthBand {
  key: HealthBandKey;
  label: string;
  /** Ring stroke — a status token. Amber, not red, for "at risk": never a red/green pair (MON-16). */
  color: string;
  /** Contrast-safe ink for the label. */
  text: string;
  /** The band's range in words, e.g. "60–79". */
  range: string;
}

const BANDS: Record<HealthBandKey, HealthBand> = {
  healthy: {
    key: "healthy",
    label: "Healthy",
    color: "var(--success)",
    text: "text-success",
    range: `${HEALTHY_FROM}+`,
  },
  stable: {
    key: "stable",
    label: "Stable",
    color: "var(--primary)",
    text: "text-primary",
    range: `${LOW_SCORE_BELOW}–${HEALTHY_FROM - 1}`,
  },
  "at-risk": {
    key: "at-risk",
    label: "At risk",
    color: "var(--warning)",
    text: "text-warning",
    range: `under ${LOW_SCORE_BELOW}`,
  },
};

/** The band a 0–100 team average falls in. */
export function healthBand(score: number): HealthBand {
  if (score >= HEALTHY_FROM) return BANDS.healthy;
  if (score >= LOW_SCORE_BELOW) return BANDS.stable;
  return BANDS["at-risk"];
}

/** Every band, best first — for a legend next to the ring. */
export const HEALTH_BANDS: readonly HealthBand[] = [BANDS.healthy, BANDS.stable, BANDS["at-risk"]];

/** True when a score is under the attention line. */
export function isLowScore(score: number): boolean {
  return score < LOW_SCORE_BELOW;
}
