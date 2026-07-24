import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Feature keys — a **mirror of `FEATURE_KEYS` in `crates/wp-contracts/src/plans.rs`**,
 * which is the single source of truth. Never add a key here that the backend doesn't
 * have: the server's `FeatureGate` decides, and a key it doesn't know is a toggle that
 * silently does nothing.
 *
 * Flat dotted sub-feature keys. **Parents do not imply children** — `monitoring.activity`
 * says nothing about `monitoring.screenshots`; the check is exact set membership.
 *
 * Gating is two-layer (LLD §1):
 *   `effective(key) = key ∈ allowed (the plan) AND enabled[key] === true (the owner)`
 * with the invariant `enabled ⊆ allowed`. This store models **layer 2 only**. Layer 1
 * arrives from `GET /v1/org/entitlements`.
 */
export type FeatureKey =
  | "time.tracking"
  | "attendance"
  | "leave"
  | "projects"
  | "reports.basic"
  | "insights.reports.ai_pdf"
  | "monitoring.activity"
  | "monitoring.screenshots"
  | "ai.insights"
  | "ai.assistant"
  | "anomalies"
  | "integrations"

const DEFAULTS: Record<FeatureKey, boolean> = {
  "time.tracking": true,
  attendance: true,
  leave: true,
  projects: true,
  "reports.basic": true,
  "insights.reports.ai_pdf": false,
  "monitoring.activity": true,
  "monitoring.screenshots": true,
  "ai.insights": true,
  "ai.assistant": true,
  anomalies: false,
  // Off by default: connecting hands WorkPulse a credential to the org's Slack workspace, so an
  // owner opts in rather than discovering it already on.
  integrations: false,
}

/**
 * v1 → v2 key migration. The old union was invented frontend-side and shared exactly one
 * value with the backend catalog, so persisted state has to be remapped rather than
 * scrubbed — dropping it would switch every feature off for anyone who had toggled one.
 *
 * Keys absent from this map were **removed**, not renamed:
 *  - `billing` — never plan-gated. Gating billing would deadlock an org out of fixing
 *    the very plan that gates it.
 *  - `approvals`, `desktop-agents` — not plan-gated; they're core.
 *  - `communication` — Inbox is DEFERRED; no key exists yet.
 *  - `integrations`, `remote-support` — removed from the backend catalog. `remote_support`
 *    is CUT entirely; `integrations` is DEFERRED with no OAuth behind it.
 */
const RENAMED_KEYS: Record<string, FeatureKey> = {
  "time-tracking": "time.tracking",
  "activity-monitoring": "monitoring.activity",
  screenshots: "monitoring.screenshots",
  reports: "reports.basic",
  // The old single `ai` toggle covered both AI surfaces; the backend splits them.
  // Carry the user's intent to both rather than guess which one they meant.
  ai: "ai.insights",
}

interface FeaturesState {
  features: Record<FeatureKey, boolean>
  toggle: (key: FeatureKey) => void
  setFeatures: (features: Record<FeatureKey, boolean>) => void
  reset: () => void
}

export const useFeaturesStore = create<FeaturesState>()(
  persist(
    (set) => ({
      features: { ...DEFAULTS },
      toggle: (key) =>
        set((s) => ({ features: { ...s.features, [key]: !s.features[key] } })),
      setFeatures: (features) => set({ features }),
      reset: () => set({ features: { ...DEFAULTS } }),
    }),
    {
      name: "wp-features",
      // v2 (2026-07-16): keys remapped onto wp-contracts' FEATURE_KEYS. Bump whenever a
      // key is renamed or removed — `migrate` only runs when the version changes, so
      // leaving it pinned strands every persisted toggle as `undefined` (i.e. off).
      version: 2,
      migrate: (persisted) => {
        const old = (persisted as { features?: Record<string, boolean> } | undefined)
          ?.features
        if (!old) return { features: { ...DEFAULTS } } as FeaturesState

        const features = { ...DEFAULTS }
        for (const [key, value] of Object.entries(old)) {
          const mapped = RENAMED_KEYS[key] ?? (key as FeatureKey)
          if (mapped in features) features[mapped] = value
        }
        // The old `ai` toggle governed both surfaces — apply it to both so turning AI
        // off stays off after the split.
        if (typeof old.ai === "boolean") features["ai.assistant"] = old.ai
        return { features } as FeaturesState
      },
    },
  ),
)
