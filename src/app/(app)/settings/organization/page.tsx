import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Organization Settings" };

export default function Page() {
  return (
    <ComingSoon
      title="Organization Settings"
      description="Company info, departments, teams, and branding."
      phase={4}
    />
  );
}
