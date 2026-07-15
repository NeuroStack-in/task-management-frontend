import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Integrations · Settings" };

// DEFERRED in the backend LLD: the OAuth catalog, connect/disconnect, and token
// storage are future work with no design yet — there is nothing to build against.
// The marketplace UI is kept at modules/integrations/ for when that design lands.
export default function Page() {
  return (
    <ComingSoon
      title="Integrations"
      description="Connect WorkPulse to the tools your team already uses."
    />
  );
}
