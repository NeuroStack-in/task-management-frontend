import type { Metadata } from "next";
import { LocationsPage } from "@/modules/locations/components/locations-page";

export const metadata: Metadata = { title: "Locations · Analytics" };

// Real data on both branches. Self-scoped employees see their own device-location trail
// (`GET /v1/me/insights/locations`); managers/admins/owners see the org oversight board
// (`GET /v1/insights/locations`). A day with no fixes degrades to an honest "waiting on the
// agent" state rather than an invented map. Dispatch lives in the client `LocationsPage`.
export default function Page() {
  return <LocationsPage />;
}
