import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "AI Center" };

export default function Page() {
  return (
    <ComingSoon
      title="AI Center"
      description="AI assistant, summaries, comparisons, and recommendations."
      phase={5}
    />
  );
}
