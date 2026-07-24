import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationsMarketplace } from "@/modules/integrations/components/integrations-marketplace";

export const metadata: Metadata = { title: "Integrations · Settings" };

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect WorkPulse to the tools your team already uses."
      />
      <IntegrationsMarketplace />
    </div>
  );
}
