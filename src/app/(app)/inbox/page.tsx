import type { Metadata } from "next";
import { InboxView } from "@/modules/communication/components/inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default function Page() {
  return <InboxView />;
}
