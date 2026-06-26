import type { Metadata } from "next";
import { users } from "@/lib/data";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardView users={users} />;
}
