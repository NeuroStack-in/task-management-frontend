import type { Metadata } from "next";
import { ReportsTab } from "@/modules/insights/components/reports-tab";

export const metadata: Metadata = { title: "Reports · Insights" };

export default function Page() {
  return <ReportsTab />;
}
