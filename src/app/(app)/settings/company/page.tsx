import type { Metadata } from "next";
import { CompanyOverview } from "@/modules/settings/components/company-overview";

export const metadata: Metadata = { title: "Company · Settings" };

export default function Page() {
  return <CompanyOverview />;
}
