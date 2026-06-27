import type { Metadata } from "next";
import { ActivityTab } from "@/modules/insights/components/activity-tab";

export const metadata: Metadata = { title: "Activity · Analytics" };

export default function Page() {
  return <ActivityTab />;
}
