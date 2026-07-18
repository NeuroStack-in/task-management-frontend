import type { Metadata } from "next";
import { FleetView } from "@/modules/agents/components/fleet-view";

export const metadata: Metadata = { title: "Device agents · Settings" };

// Real fleet, via GET /v1/fleet (fleet context, LLD §18): the AgentDevice records the
// ingest-processor writes from each agent's heartbeat, with read-time connectivity. Empty until
// agents are enrolled and reporting — an honest empty state, not a mock fleet.
export default function Page() {
  return <FleetView />;
}
