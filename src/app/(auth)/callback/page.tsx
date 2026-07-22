import type { Metadata } from "next";
import { Suspense } from "react";
import { SsoCallback } from "@/modules/auth/components/sso-callback";
import { AuthShell } from "@/modules/auth/components/auth-shell";

export const metadata: Metadata = { title: "Signing in…" };

/**
 * OAuth redirect target for federated / SSO sign-in. Thin: the client component completes the PKCE
 * exchange. Wrapped in `Suspense` because it reads the query string via `useSearchParams`.
 */
export default function CallbackPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <SsoCallback />
      </Suspense>
    </AuthShell>
  );
}
