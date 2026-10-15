"use client";

/**
 * `/callback` — the OAuth redirect target. Cognito bounces the browser here after federation with
 * `?code=…&state=…`; we complete the PKCE exchange (which persists the session), hydrate the auth
 * store, and forward to the app. On any failure we route back to `/login` with a generic message —
 * never a blank screen, never a leaked reason.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { landAfterSignIn, useAuthStore } from "@/stores/auth.store";
import { Loader } from "@/components/shared/loader";
import { currentRoleSnapshot } from "@/hooks/use-permissions";
import { safeLandingPath } from "@/lib/rbac";
import { ssoFailureCode } from "@/lib/oauth";

export function SsoCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const completeSso = useAuthStore((s) => s.completeSso);
  const [failed, setFailed] = useState(false);
  // Strict-mode mounts effects twice in dev; the exchange is single-use (code + verifier), so guard it.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    completeSso()
      .then(() => {
        // A full page load when this replaced someone else's session (WP-387).
        landAfterSignIn(router, safeLandingPath(currentRoleSnapshot(), params.get("from")));
      })
      .catch((e: unknown) => {
        setFailed(true);
        // A code the sign-in page has its own copy for — never the provider's text (WP-107).
        setTimeout(() => router.replace(`/login?error=${ssoFailureCode(e)}`), 1200);
      });
  }, [completeSso, params, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      {/* The page's heading for assistive tech; the loader below says the same visually (WP-368). */}
      <h1 className="sr-only">{failed ? "Sign-in failed" : "Completing sign-in"}</h1>
      <Loader label={failed ? "Sign-in failed — taking you back…" : "Completing sign-in…"} />
    </div>
  );
}
