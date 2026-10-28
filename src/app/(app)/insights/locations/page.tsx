import type { Metadata } from "next";
import { LocationsPage } from "@/modules/locations/components/locations-page";

export const metadata: Metadata = { title: "Locations · Analytics" };

// The org oversight board (`GET /v1/insights/locations`) for roles with `locations:view`. There is no
// personal view: employees see none of their own monitoring data (AI audit 2026-10-22, AI-33). A day
// with no fixes degrades to an honest "waiting on the agent" state rather than an invented map.
export default function Page() {
  return <LocationsPage />;
}
