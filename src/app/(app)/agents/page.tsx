import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Desktop Agent Management" };

export default function Page() {
  return (
    <ComingSoon
      title="Desktop Agent Management"
      description="Agent status, configuration, policies, and health."
      phase={5}
    />
  );
}
