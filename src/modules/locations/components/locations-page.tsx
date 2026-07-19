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
  return useIsSelfScoped() ? <MyLocationView /> : <LocationsView />;
}
