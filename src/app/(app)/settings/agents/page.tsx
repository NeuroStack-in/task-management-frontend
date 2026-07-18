import type { Metadata } from "next";
import { AgentsManager } from "@/modules/agents/components/agents-manager";

export const metadata: Metadata = { title: "Device agents · Settings" };

// Live against `GET /v1/fleet` + `GET /v1/fleet/{id}` (LLD §18, `fleet` context). Both routes are
// deployed and gated on `agents:manage`; verified against the dev stack 2026-07-18.
//
// The dev tenant currently holds one seeded QA row (`test-agent-emp1`, agent_version `0.0.1-test`,
// heartbeat far in the past → renders offline). It is *not* a real agent check-in — no desktop agent
// has enrolled yet. Don't read that row as evidence the ingest path works.
export default function Page() {
  return <AgentsManager />;
}
