import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Screenshot Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Screenshot Center"
      description="Screenshot gallery, timeline, and risk analysis."
      phase={3}
    />
  );
}
