import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Integrations Marketplace" };

export default function Page() {
  return (
    <ComingSoon
      title="Integrations Marketplace"
      description="Slack, Teams, Jira, GitHub, and more."
      phase={4}
    />
  );
}
