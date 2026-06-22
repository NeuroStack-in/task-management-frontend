import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Activity Monitoring" };

export default function Page() {
  return (
    <ComingSoon
      title="Activity Monitoring"
      description="Active vs inactive analysis, heatmaps, and app/URL usage."
      phase={3}
    />
  );
}
