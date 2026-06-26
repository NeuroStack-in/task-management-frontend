import type { Metadata } from "next";
import { IntegrationsMarketplace } from "@/modules/integrations/components/integrations-marketplace";

export const metadata: Metadata = { title: "Integrations · Settings" };

export default function Page() {
  return <IntegrationsMarketplace />;
}
