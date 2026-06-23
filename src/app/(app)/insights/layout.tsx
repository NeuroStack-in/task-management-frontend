import { PageHeader } from "@/components/shared/page-header";
import { InsightsTabs } from "@/modules/insights/components/insights-tabs";

/**
 * Shared shell for the merged Insights section: one header + a tab bar, with the
 * active tab's content rendered below. Tabs are nested routes
 * (/insights/activity, /insights/anomalies, …) so each is deep-linkable and
 * keeps its own permission guard.
 */
export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Insights"
        description="Activity, screenshots, anomalies, reports, and AI — in one place."
      />
      <InsightsTabs />
      <div>{children}</div>
    </div>
  );
}
