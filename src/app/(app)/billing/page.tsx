import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Billing & Subscription" };

export default function Page() {
  return (
    <ComingSoon
      title="Billing & Subscription"
      description="Plans, invoices, usage, and payment methods."
      phase={4}
    />
  );
}
