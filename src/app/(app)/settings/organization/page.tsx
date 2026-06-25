import type { Metadata } from "next"
import { OrganizationTab } from "@/modules/settings/components/organization-tab"

export const metadata: Metadata = { title: "Organization · Settings" }

export default function Page() {
  return <OrganizationTab />
}
