import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Remote Support Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Remote Support Center"
      description="Approval-gated remote support sessions and diagnostics."
      phase={5}
    />
  );
}
