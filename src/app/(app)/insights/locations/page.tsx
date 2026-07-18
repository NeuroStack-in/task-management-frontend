import type { Metadata } from "next";
import { AgentPending } from "@/components/shared/agent-pending";

export const metadata: Metadata = { title: "Locations · Analytics" };

// `location` is a free-text field on the employee profile, not a tracked feature — live location
// comes from the desktop agent's network signals, which aren't reporting. So this shows an honest
// pending state instead of a mock map. The map UI is kept at modules/locations/ for when the agent
// sends location data.
export default function Page() {
  return (
    <AgentPending
      title="Locations"
      description="Where your team is working from."
      detail="A live map and per-person location history appear here once the WorkPulse desktop agent reports network location. It isn't sending data yet."
    />
  );
}
