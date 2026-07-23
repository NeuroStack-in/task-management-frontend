import type { Metadata } from "next";
import { AgentsManager } from "@/modules/agents/components/agents-manager";

export const metadata: Metadata = { title: "Device agents · Settings" };

// Device agents management UI: fleet roster + per-device detail + fleet-wide agent settings.
// UI-first — the roster is demo data (see lib/mock-agents) until the real fleet (GET /v1/fleet,
// LLD §18) and the enrolment/download pipeline are wired. FleetView (the real GET /v1/fleet view)
// is retained in the module for that reconnection.
export default function Page() {
  return <AgentsManager />;
}
