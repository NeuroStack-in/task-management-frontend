import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Job Portal" };

export default function Page() {
  return (
    <ComingSoon
      title="Job Portal"
      description="Internal jobs, applications, and candidate pipeline."
      phase={4}
    />
  );
}
