import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Reports Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Reports Center"
      description="Productivity, time, project, and AI reports with CSV/PDF export."
      phase={3}
    />
  );
}
