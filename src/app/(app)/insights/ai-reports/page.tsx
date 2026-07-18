import type { Metadata } from "next";
import { ReportsExperimental } from "@/modules/insights/components/reports-experimental";
import { DailySummaryCard } from "@/modules/insights/components/daily-summary-card";

export const metadata: Metadata = { title: "AI reports · Analytics" };

/**
 * The AI-first reports surface, now fully live. `DailySummaryCard` reads the caller's own day
 * (`/v1/me/insights/summary` — real metrics + score + AI narrative); `ReportsExperimental` reads the
 * org AI executive report (`/v1/insights/reports/ai`, entitlement-gated), the report catalog, and the
 * people-attention ranking (`/v1/insights/attention`).
 */
export default function Page() {
  return (
    <div className="space-y-6">
      <DailySummaryCard />
      <ReportsExperimental />
    </div>
  );
}
