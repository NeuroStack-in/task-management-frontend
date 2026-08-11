import type { FeatureKey } from "@/stores/features.store";
import type { TrackingMode } from "@/lib/tracking-mode";

/**
 * Which route belongs to which org feature — the **single** place that mapping lives.
 *
 * Settings → Features promises that a disabled feature is "hidden from all users". Nothing was
 * enforcing that: nav and routes gate on RBAC only and never consulted entitlements, so switching
 * a feature off changed a flag and nothing else. These pairs are what make the toggle mean
 * something in the UI.
 *
 * Keys mirror `FEATURE_KEYS` in `crates/wp-contracts/src/plans.rs` — never invent one here.
 *
 * Deliberately **not** listed:
 *  - `/dashboard`, `/employees`, `/notifications`, `/settings`, `/help` — core, never plan-gated.
 *  - `/payroll` — no key exists in the catalog for it.
 *  - `/insights` (the hub) — its tabs are gated individually; gating the parent would take the
 *    whole section away the moment any one feature was switched off.
 *
 * This is UX, not security: the server is the real boundary. The point is to stop showing people
 * a section their org has turned off.
 */
export const ROUTE_FEATURES: ReadonlyArray<{
  href: string;
  feature: FeatureKey;
}> = [
  { href: "/time-tracking", feature: "time.tracking" },
  { href: "/projects", feature: "projects" },
  { href: "/attendance", feature: "attendance" },
  { href: "/leave-requests", feature: "leave" },
  // The approval queue is part of the Leave feature ("…requests, and the approval queue").
  { href: "/approvals", feature: "leave" },
  { href: "/insights/activity", feature: "monitoring.activity" },
  // Locations are captured by the same monitoring pipeline as activity; there is no separate key.
  { href: "/insights/locations", feature: "monitoring.activity" },
  { href: "/insights/screenshots", feature: "monitoring.screenshots" },
  { href: "/insights/ai-reports", feature: "insights.reports.ai_pdf" },
  { href: "/insights/anomalies", feature: "anomalies" },
  { href: "/insights/reports", feature: "reports.basic" },
  // Settings lives outside the sidebar nav, but the guard resolves by pathname — so switching
  // Integrations off closes the page as well as hiding its entry in the settings index.
  { href: "/settings/integrations", feature: "integrations" },
];

/** The feature a given href belongs to, or `null` when it isn't feature-gated. */
export function featureForHref(href: string): FeatureKey | null {
  return ROUTE_FEATURES.find((r) => r.href === href)?.feature ?? null;
}

/**
 * Routes a **tracking mode** hides, whatever the plan and the owner's toggles say (MANAGED-AGENT.md
 * §4/§8). This is the source of truth (hrefs, so it can cover modules with no feature key — e.g.
 * `/payroll`); `MODE_HIDDEN_FEATURES` below is *derived* from it, for badging the Features tab.
 *
 * `machine` mode is a **monitoring-only console**: it hides Projects, Leave/Approvals and Payroll —
 * surfaces a login-less org has no operator for. **`/time-tracking` is deliberately NOT here**: that
 * is where logon time surfaces; what machine mode hides is the *project timer*, not *time*.
 *
 * ⚠️ The API stays open for these routes — mode hiding is a **UI shape, not a security boundary**
 * (MANAGED-AGENT.md §4.3). `/payroll` in particular has no feature key and is hidden by route only.
 */
export const MODE_HIDDEN_ROUTES: Record<TrackingMode, readonly string[]> = {
  project: [],
  machine: ["/projects", "/leave-requests", "/approvals", "/payroll"],
  both: [],
};

/**
 * The feature keys a mode hides — derived from `MODE_HIDDEN_ROUTES` via `featureForHref`, so a route
 * with no key (e.g. `/payroll`) simply contributes nothing here. Used to badge the Features tab and
 * to layer the mode onto `useIsSurfaceOn`.
 */
/**
 * Is this pathname hidden by the org's tracking mode? True when any route the mode hides equals or is
 * a prefix of `pathname` (so `/projects/123` is hidden with `/projects`). Covers the key-less routes
 * (`/payroll`) that `featureForPath` cannot, since `MODE_HIDDEN_ROUTES` lists hrefs, not feature keys.
 */
export function isPathModeHidden(pathname: string, mode: TrackingMode): boolean {
  return MODE_HIDDEN_ROUTES[mode].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

function hiddenFeaturesFor(mode: TrackingMode): readonly FeatureKey[] {
  return MODE_HIDDEN_ROUTES[mode]
    .map((href) => featureForHref(href))
    .filter((f): f is FeatureKey => f !== null);
}

export const MODE_HIDDEN_FEATURES: Record<TrackingMode, readonly FeatureKey[]> = {
  project: hiddenFeaturesFor("project"),
  machine: hiddenFeaturesFor("machine"),
  both: hiddenFeaturesFor("both"),
};

/**
 * The feature governing a pathname — most specific (longest href) match wins, so
 * `/insights/screenshots` resolves to screenshots rather than to any shorter prefix.
 */
export function featureForPath(pathname: string): FeatureKey | null {
  let match: (typeof ROUTE_FEATURES)[number] | null = null;
  for (const r of ROUTE_FEATURES) {
    if (pathname === r.href || pathname.startsWith(`${r.href}/`)) {
      if (!match || r.href.length > match.href.length) match = r;
    }
  }
  return match?.feature ?? null;
}
