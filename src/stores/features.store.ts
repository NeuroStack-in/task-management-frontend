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
 * with the invariant `enabled ⊆ allowed`. **Both layers come from the server**
 * (`GET /v1/org/entitlements` → `stores/entitlements.store.ts`).
 *
 * Only the type lives here now. The persisted `useFeaturesStore` (local defaults, a v1→v2 key
 * migration, the `wp-features` key) was never imported as a value, so it never existed at
 * runtime — it was a second, disagreeing copy of the toggles waiting to be wired in by mistake
 * (QA audit 2026-10-08, WP-528).
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
