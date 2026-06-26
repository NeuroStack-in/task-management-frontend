import { redirect } from "next/navigation";

// Audit Logs now lives inside the Settings hub; keep the old URL working.
export default function Page() {
  redirect("/settings/audit-logs");
}
