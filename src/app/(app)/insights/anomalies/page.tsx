import type { Metadata } from "next";
import { AnomaliesTab } from "@/modules/insights/components/anomalies-tab";

export const metadata: Metadata = { title: "Anomalies · Insights" };

export default function Page() {
  return <AnomaliesTab />;
}
