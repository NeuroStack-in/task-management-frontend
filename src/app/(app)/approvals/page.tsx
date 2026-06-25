import type { Metadata } from "next";
import { ApprovalsView } from "@/modules/approvals/components/approvals-view";

export const metadata: Metadata = { title: "Approval Center" };

export default function Page() {
  return <ApprovalsView />;
}
