import type { Metadata } from "next";
import { BillingView } from "@/modules/billing/components/billing-view";

export const metadata: Metadata = { title: "Billing & Subscription" };

export default function Page() {
  return <BillingView />;
}
