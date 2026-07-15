import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Inbox" };

// DEFERRED in the backend LLD — "the one new subsystem; deserves its own design".
// Real-time messaging, channels, and retention are unspecified, so there is nothing
// to build against. The UI is kept at modules/communication/ for when that lands.
export default function Page() {
  return (
    <ComingSoon
      title="Inbox"
      description="Direct messages and channels for your team."
    />
  );
}
