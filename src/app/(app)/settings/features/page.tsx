import type { Metadata } from "next"
import { FeaturesTab } from "@/modules/settings/components/features-tab"

export const metadata: Metadata = { title: "Features · Settings" }

export default function Page() {
  return <FeaturesTab />
}
