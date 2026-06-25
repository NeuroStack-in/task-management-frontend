import type { Metadata } from "next"
import { TrackingRulesTab } from "@/modules/settings/components/tracking-rules-tab"

export const metadata: Metadata = { title: "Application & URL Rules · Settings" }

export default function Page() {
  return <TrackingRulesTab />
}
