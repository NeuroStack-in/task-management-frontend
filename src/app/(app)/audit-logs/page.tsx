import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Audit Logs" };

export default function Page() {
  return (
    <ComingSoon
      title="Audit Logs"
      description="User actions, permission changes, and login events."
      phase={4}
    />
  );
}
