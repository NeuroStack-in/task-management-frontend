"use client";

/**
 * Insights › Location — the org oversight board (`LocationsView`, real `GET /v1/insights/locations`):
 * the AI report hero, live map, geofence, and per-employee trail.
 *
 * **There is no personal view any more** (AI audit 2026-10-22, AI-33). Self-scoped roles used to get
 * `MyLocationView`, their own trail from `GET /v1/me/insights/locations`. Employees see none of their
 * own monitoring data (owner decision 2026-10-17, confirmed 2026-10-28 to cover the API), and the
 * server now refuses that route to a caller who can see only themselves. The branch was unreachable
 * anyway: this tab is gated on `locations:view` (`INSIGHTS_TABS`), which a self-scoped role lacks,
 * so `AuthGuard` stopped them before the dispatcher ever chose the personal view.
 */
import { LocationsView } from "./locations-board";

export function LocationsPage() {
  return <LocationsView />;
}
