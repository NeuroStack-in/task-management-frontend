import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Time Tracking" };

export default function Page() {
  return (
    <ComingSoon
      title="Time Tracking"
      description="Live timer, timesheets, manual entries, and approvals."
      phase={2}
    />
  );
}
