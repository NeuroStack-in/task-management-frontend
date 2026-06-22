import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Monitoring Configuration" };

export default function Page() {
  return (
    <ComingSoon
      title="Monitoring Configuration"
      description="Idle, screenshot, and productivity thresholds."
      phase={4}
    />
  );
}
