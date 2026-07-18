import type { Metadata } from "next";
import { ReportsExperimental } from "@/modules/insights/components/reports-experimental";
import { DailySummaryCard } from "@/modules/insights/components/daily-summary-card";

export const metadata: Metadata = { title: "AI reports · Analytics" };

/**
 * The AI-first reports surface. `DailySummaryCard` is the one **real** AI read here — the caller's
 * own day from `/v1/me/insights/summary` (real metrics + an AI narrative). The rest of
 * `ReportsExperimental` is still mock (org-wide reports need agent data / read routes that don't
 * exist yet).
 */
export default function Page() {
  return (
    <div className="space-y-6">
      <DailySummaryCard />
      <ReportsExperimental />
    </div>
  );
}
