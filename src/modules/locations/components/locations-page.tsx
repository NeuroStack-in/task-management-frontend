"use client";

/**
 * Insights › Location — the top-level dispatcher.
 *
 *  - **Self-scoped roles (Employee)** see only their own device-location trail (`MyLocationView`,
 *    real `GET /v1/me/insights/locations`), unchanged.
 *  - **Everyone else** (manager / admin / owner) gets the org oversight board (`LocationsView`, real
 *    `GET /v1/insights/locations`) — the AI report hero, live map, geofence, and per-employee trail.
 *
 * Same seam every other tab uses (`useIsSelfScoped`); no mock is imported on either branch.
 */
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { MyLocationView } from "./my-location-view";
import { LocationsView } from "./locations-board";

export function LocationsPage() {
  // The board reads `GET /v1/insights/locations` (`ActivityReadTeam` → `locations:view`); a team-only
  // reader was sent to the personal view by the old directory/activity proxy (QA audit 2026-10-08, WP-322).
  return useIsSelfScoped(["locations:view"]) ? <MyLocationView /> : <LocationsView />;
}
