import type { Metadata } from "next";
import { AgentsManager } from "@/modules/agents/components/agents-manager";

export const metadata: Metadata = { title: "Device agents · Settings" };

export default function Page() {
  return <AgentsManager />;
}
