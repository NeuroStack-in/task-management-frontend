import type { Metadata } from "next"
import { HelpPage } from "@/modules/help/components/help-page"

export const metadata: Metadata = { title: "Help center" }

export default function Page() {
  return <HelpPage />
}
