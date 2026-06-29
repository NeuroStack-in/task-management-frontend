import type { Metadata } from "next";
import { LeaveRequestsView } from "@/modules/leave/components/leave-requests-view";

export const metadata: Metadata = { title: "Leave" };

export default function LeaveRequestsPage() {
  return <LeaveRequestsView />;
}
