import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      description="Organization, monitoring, tracking, and feature settings."
      phase={4}
    />
  );
}
