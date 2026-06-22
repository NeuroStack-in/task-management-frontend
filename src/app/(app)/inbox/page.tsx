import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return (
    <ComingSoon
      title="Inbox"
      description="Business mail, announcements, and templates."
      phase={4}
    />
  );
}
