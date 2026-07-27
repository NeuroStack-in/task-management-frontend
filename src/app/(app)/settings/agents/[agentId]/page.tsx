import type { Metadata } from "next";
import { DeviceDetailView } from "@/modules/agents/components/device-detail-view";

export const metadata: Metadata = { title: "Device agent · Settings" };

// One device, one page — the real reads: `GET /v1/fleet/{agent_id}` (LLD §18) plus the owner
// lookup, and `POST /v1/fleet/{id}/capture-now`. (Was `AgentDetailPage`, a lib/mock-agents record
// synthesised deterministically per agent id, which paired with the mock roster.)
export default async function Page({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <DeviceDetailView agentId={agentId} />;
}
