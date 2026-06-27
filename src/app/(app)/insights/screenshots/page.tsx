import type { Metadata } from "next";
import { ScreenshotsTab } from "@/modules/insights/components/screenshots-tab";

export const metadata: Metadata = { title: "Screenshots · Analytics" };

export default function Page() {
  return <ScreenshotsTab />;
}
