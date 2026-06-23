import type { Metadata } from "next";
import { ActivityTab } from "@/modules/insights/components/activity-tab";

export const metadata: Metadata = { title: "Activity · Insights" };

export default function Page() {
  return <ActivityTab />;
}
