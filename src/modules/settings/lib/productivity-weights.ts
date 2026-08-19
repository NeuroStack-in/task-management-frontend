/**
 * Productivity score term weights — the pure model shared by the org-default card and the
 * per-department sheet.
 *
 * The backend stores the four term weights as **fractions summing to 1.0**
 * (`{ u, q, f, r }`, e.g. `0.25 / 0.40 / 0.15 / 0.20`). Humans reason in **percentages summing to
 * 100**, so every editor works in whole-percent space and converts at the API boundary. The two
 * conversions live here — pure, dependency-free — so they can be unit-tested away from React.
 *
 * The four terms mirror the "Productivity trends" widget's info popover
 * (`modules/dashboard/components/productivity-trend-chart.tsx`): Utilisation, Quality, Focus,
 * Reliability.
 */
import type { ProductivityWeights } from "../services/productivity.service";

/** The four score terms, in canonical display order. */
export const WEIGHT_TERMS = ["u", "q", "f", "r"] as const;
export type WeightTerm = (typeof WEIGHT_TERMS)[number];

/** Whole-percent form of the four weights (what the UI edits). */
export type PercentWeights = Record<WeightTerm, number>;

/** Human labels + one-line meanings, kept in step with the Productivity-trends popover. */
export const WEIGHT_META: Record<
  WeightTerm,
  { label: string; blurb: string }
> = {
  u: { label: "Utilisation", blurb: "How much of the day was active." },
  q: { label: "Quality", blurb: "Active time spent in productive apps." },
  f: { label: "Focus", blurb: "Steady work vs. constant switching." },
  r: { label: "Reliability", blurb: "Showing up consistently." },
};

/**
 * The product-wide fallback used before an org (or department) sets anything. Matches the fixed
 * blend the "Productivity trends" popover documents: U 25% · Q 40% · F 15% · R 20%.
 */
export const GLOBAL_DEFAULT_WEIGHTS: ProductivityWeights = {
  u: 0.25,
  q: 0.4,
  f: 0.15,
  r: 0.2,
};

/**
 * Distribute `target` whole units across `values` by the **largest-remainder** method: floor every
 * value, then hand the leftover units to the entries with the biggest fractional parts. This keeps
 * the rounded percentages summing to exactly `target` (100) even when the fractions are ugly
 * (e.g. three equal thirds render as 34/33/33, never 33/33/33 = 99).
 */
function largestRemainderRound(values: number[], target: number): number[] {
  const out = values.map((v) => Math.floor(v));
  let rem = target - out.reduce((a, b) => a + b, 0);
  const byFrac = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (rem > 0) {
    out[byFrac[k % byFrac.length].i] += 1;
    rem -= 1;
    k += 1;
  }
  // A total above target (fractions summing past 1) — claw back from the smallest fractions.
  let j = byFrac.length - 1;
  while (rem < 0 && j >= 0) {
    if (out[byFrac[j].i] > 0) {
      out[byFrac[j].i] -= 1;
      rem += 1;
    }
    j -= 1;
  }
  return out;
}

/**
 * Fractions (0–1) → whole percentages that sum to 100. Uses largest-remainder rounding so the four
 * displayed numbers always total 100.
 */
export function toPercents(w: ProductivityWeights): PercentWeights {
  const values = WEIGHT_TERMS.map((t) => (w[t] ?? 0) * 100);
  const total = Math.round(values.reduce((a, b) => a + b, 0));
  const rounded = largestRemainderRound(values, total === 0 ? 0 : total);
  return {
    u: rounded[0],
    q: rounded[1],
    f: rounded[2],
    r: rounded[3],
  };
}

/** Percentages (0–100) → fractions (0–1) for the API. A plain divide-by-100 per term. */
export function toFractions(p: PercentWeights): ProductivityWeights {
  return {
    u: p.u / 100,
    q: p.q / 100,
    f: p.f / 100,
    r: p.r / 100,
  };
}

/** Sum of the four percentages. */
export function percentsSum(p: PercentWeights): number {
  return WEIGHT_TERMS.reduce((acc, t) => acc + (p[t] || 0), 0);
}

/** True when the four percentages total exactly 100 — the save gate. */
export function isValidPercentSum(p: PercentWeights): boolean {
  return percentsSum(p) === 100;
}
