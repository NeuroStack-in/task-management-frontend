import { MonitorSmartphone } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

/**
 * Honest placeholder for features whose data comes from the **desktop agent** — which isn't
 * reporting yet. Unlike `ComingSoon` (unbuilt future phase), these are built and waiting on live
 * agent data, so they say exactly that rather than showing invented devices/locations/activity.
 */
export function AgentPending({
  title,
  description,
  detail,
}: {
  title: string;
  description?: string;
  /** What specifically will appear here once the agent reports. */
  detail: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={MonitorSmartphone}
        title="Waiting on the desktop agent"
        description={detail}
      />
    </div>
  );
}
