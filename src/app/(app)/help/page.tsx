import type { Metadata } from "next"
import { HelpPage } from "@/modules/help/components/help-page"

export const metadata: Metadata = { title: "Help Center" }

export default function Page() {
  return <HelpPage />
}
