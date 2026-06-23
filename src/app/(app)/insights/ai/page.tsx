import type { Metadata } from "next";
import { AiTab } from "@/modules/insights/components/ai-tab";

export const metadata: Metadata = { title: "AI Center · Insights" };

export default function Page() {
  return <AiTab />;
}
