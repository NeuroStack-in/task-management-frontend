import type { Metadata } from "next";
import { ReportsExperimental } from "@/modules/insights/components/reports-experimental";

export const metadata: Metadata = { title: "AI reports · Analytics" };

/**
 * The AI-first reports surface: AI briefing, workforce health, and the report
 * library (list / board views) with search and smart collections.
 */
export default function Page() {
  return <ReportsExperimental />;
}
