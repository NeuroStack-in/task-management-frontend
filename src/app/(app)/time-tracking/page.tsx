import type { Metadata } from "next";
import { TimeTrackingView } from "@/modules/time-tracking/components/time-tracking-view";

export const metadata: Metadata = { title: "Time Tracking" };

export default function Page() {
  return <TimeTrackingView />;
}
