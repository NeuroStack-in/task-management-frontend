import type { Metadata } from "next"
import { MonitoringTab } from "@/modules/settings/components/monitoring-tab"

export const metadata: Metadata = { title: "Monitoring · Settings" }

export default function Page() {
  return <MonitoringTab />
}
