import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Notification Center" };

export default function Page() {
  return (
    <ComingSoon
      title="Notification Center"
      description="Alerts, reminders, and notification preferences."
      phase={4}
    />
  );
}
