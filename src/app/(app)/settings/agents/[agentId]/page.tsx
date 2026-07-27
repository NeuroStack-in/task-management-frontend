import type { Metadata } from "next";
import { AgentDetailPage } from "@/modules/agents/components/agent-detail-page";

export const metadata: Metadata = { title: "Device agent · Settings" };

// One device, one page. UI-first: the record comes from lib/mock-agents (deterministic per
// agent id) while the roster on /settings/agents is still demo data. The wiring pass points
// this at the real reads — GET /v1/fleet/{agent_id} (LLD §18) plus the owner lookup — which is
// what `device-detail-view.tsx` (kept in the module, alongside FleetView) already implements.
export default async function Page({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentDetailPage agentId={agentId} />;
}
