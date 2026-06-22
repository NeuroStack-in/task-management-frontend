import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Employee Management" };

export default function Page() {
  return (
    <ComingSoon
      title="Employee Management"
      description="Directory, profiles, teams, and performance history."
      phase={3}
    />
  );
}
