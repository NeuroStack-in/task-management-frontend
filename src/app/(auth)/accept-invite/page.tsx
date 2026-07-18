import { Suspense } from "react";
import type { Metadata } from "next";
import { AcceptInviteForm } from "@/modules/auth/components/accept-invite-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";
import { Loader } from "@/components/shared/loader";

export const metadata: Metadata = { title: "Accept invite" };

// Public route — `GET /v1/invites/{id}` and `POST /v1/invites/accept` sit outside the JWT
// authorizer, so this page works with no session. The emailed link shape is:
//   /accept-invite?invite=<invite_id>&tenant=<tenant_id>&token=<token>
// `Suspense` is required because the form reads those via `useSearchParams`.
export default function AcceptInvitePage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loader label="Checking your invite…" />}>
        <AcceptInviteForm />
      </Suspense>
    </AuthShell>
  );
}
