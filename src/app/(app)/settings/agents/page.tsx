import type { Metadata } from "next";
import { FleetView } from "@/modules/agents/components/fleet-view";

export const metadata: Metadata = { title: "Device agents · Settings" };

// The real fleet roster — `GET /v1/fleet` (LLD §18), read-time connectivity and telemetry off each
// agent's heartbeat. Honest-empty until a device enrols: no device appears until the desktop agent
// is installed and signed in. (Was `AgentsManager`, a lib/mock-agents roster of seven fictional
// employees; the fleet-wide agent settings it also carried are the real ones in Settings →
// Monitoring, which write `PUT /v1/fleet/update-policy`.)
export default function Page() {
  return <FleetView />;
}
