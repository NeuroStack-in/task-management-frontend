import type { Metadata } from "next";
import { TimeTrackingView } from "@/modules/time-tracking/components/time-tracking-view";

export const metadata: Metadata = { title: "Time tracking" };

export default function TimeTrackingPage() {
  return <TimeTrackingView />;
}
