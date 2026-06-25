import type { Metadata } from "next";
import { AuditLogs } from "@/modules/audit/components/audit-logs";

export const metadata: Metadata = { title: "Audit Logs" };

export default function Page() {
  return <AuditLogs />;
}
