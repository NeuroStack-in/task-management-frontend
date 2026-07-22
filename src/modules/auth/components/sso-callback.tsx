"use client";

/**
 * `/callback` — the OAuth redirect target. Cognito bounces the browser here after federation with
 * `?code=…&state=…`; we complete the PKCE exchange (which persists the session), hydrate the auth
 * store, and forward to the app. On any failure we route back to `/login` with a generic message —
 * never a blank screen, never a leaked reason.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Loader } from "@/components/shared/loader";

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
        const from = params.get("from");
        router.replace(from && from.startsWith("/") ? from : "/dashboard");
      })
      .catch(() => {
        setFailed(true);
        setTimeout(
          () => router.replace("/login?error=We%20couldn%27t%20complete%20your%20sign-in."),
          1200,
        );
      });
  }, [completeSso, params, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader label={failed ? "Sign-in failed — taking you back…" : "Completing sign-in…"} />
    </div>
  );
}
