import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Security Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Security Center"
      description="MFA, SSO, session policies, and security events."
      phase={4}
    />
  );
}
