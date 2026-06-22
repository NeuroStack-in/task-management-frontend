import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Help Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Help Center"
      description="Documentation, tutorials, FAQs, and support tickets."
      phase={5}
    />
  );
}
