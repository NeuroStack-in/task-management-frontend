import type { Metadata } from "next";
import { MyLocationView } from "@/modules/locations/components/my-location-view";

export const metadata: Metadata = { title: "Locations · Analytics" };

// Backed by the real `insights` route `GET /v1/me/insights/locations`: the desktop agent reports a
// device location on each heartbeat (consent-gated), the ingest fold stores it as a per-day trail,
// and this renders it. A day with no fixes degrades to an honest "waiting on the agent" state.
export default function Page() {
  return <MyLocationView />;
}
