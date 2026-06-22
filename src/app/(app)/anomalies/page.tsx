import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Anomaly Detection" };

export default function Page() {
  return (
    <ComingSoon
      title="Anomaly Detection"
      description="Inactivity, productivity drops, and burnout indicators."
      phase={5}
    />
  );
}
