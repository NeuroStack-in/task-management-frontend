import type { Metadata } from "next";
import { AgentsManager } from "@/modules/agents/components/agents-manager";

export const metadata: Metadata = { title: "Desktop Agents · Settings" };

export default function Page() {
  return <AgentsManager />;
}
