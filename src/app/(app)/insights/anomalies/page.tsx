import type { Metadata } from "next";
import { AiInsightsTab } from "@/modules/insights/components/ai-insights-tab";

export const metadata: Metadata = { title: "AI Insights · Analytics" };

export default function Page() {
  return <AiInsightsTab />;
}
