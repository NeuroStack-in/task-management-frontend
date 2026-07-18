import { Suspense } from "react";
import type { Metadata } from "next";
import { InviteAcceptForm } from "@/modules/auth/components/invite-accept-form";

export const metadata: Metadata = { title: "Accept your invite" };

export default function InviteAcceptPage() {
  // The form reads the link's query params via useSearchParams, so it must sit under Suspense.
  return (
    <Suspense>
      <InviteAcceptForm />
    </Suspense>
  );
}
