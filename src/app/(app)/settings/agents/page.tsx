import type { Metadata } from "next";
import { AgentPending } from "@/components/shared/agent-pending";

export const metadata: Metadata = { title: "Device agents · Settings" };

// The fleet backend only serves `/v1/agent/config` to the agent itself — there is no admin
// device-list route, and no agents are enrolled/reporting yet. So this shows an honest pending
// state instead of a mock fleet. The device-table UI is kept at modules/agents/ for when a fleet
// read route + live agents exist.
export default function Page() {
  return (
    <AgentPending
      title="Device agents"
      description="Machines running the WorkPulse desktop agent."
      detail="Enrolled devices, their status, and last check-in appear here once the WorkPulse desktop agent is installed and reporting. No agents are sending data yet."
    />
  );
}
