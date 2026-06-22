import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Feature Management" };

export default function Page() {
  return (
    <ComingSoon
      title="Feature Management"
      description="Enable or disable modules organization-wide."
      phase={4}
    />
  );
}
