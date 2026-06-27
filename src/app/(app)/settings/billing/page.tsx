import type { Metadata } from "next";
import { BillingSettings } from "@/modules/settings/components/billing-settings";

export const metadata: Metadata = { title: "Billing · Settings" };

export default function Page() {
  return <BillingSettings />;
}
