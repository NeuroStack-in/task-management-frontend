import { DeviceDetailView } from "@/modules/agents/components/device-detail-view";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <DeviceDetailView agentId={agentId} />;
}
