import type { Metadata } from "next";
import { ReportsExperimental } from "@/modules/insights/components/reports-experimental";

export const metadata: Metadata = { title: "AI reports · Analytics" };

/**
 * The AI-first reports surface (preview layout), fully live. `ReportsExperimental` reads the org AI
 * executive report (`/v1/insights/reports/ai`, entitlement-gated), the people-attention ranking
 * (`/v1/insights/attention`), and the report catalog (`/v1/insights/reports`).
 */
export default function Page() {
  return <ReportsExperimental />;
}
