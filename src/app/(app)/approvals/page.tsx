import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Approval Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Approval Center"
      description="Timesheets, manual entries, leave, and corrections."
      phase={4}
    />
  );
}
