import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Application & URL Management" };

export default function Page() {
  return (
    <ComingSoon
      title="Application & URL Management"
      description="Allow/block lists and productivity scoring."
      phase={4}
    />
  );
}
