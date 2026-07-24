import type { FeatureKey } from "@/stores/features.store";

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
