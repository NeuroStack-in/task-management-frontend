"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { completeConnect } from "@/modules/integrations/services/integrations.service";
import { ApiError } from "@/lib/api";

/**
 * Where the provider sends the browser back after consent.
 *
 * This page is inside the authenticated tree on purpose. It reads the one-time `code` from the
 * query string and posts it to the backend **with the user's token**, which is what lets every
 * backend route stay behind the authorizer — there is no public callback endpoint to defend.
 *
 * The provider isn't in the query string, because `redirect_uri` must match the value registered
 * with the provider *exactly* and cannot carry a per-provider suffix. So the marketplace stashes it
 * in `sessionStorage` before navigating away, and it is read back here.
 */
const PROVIDER_KEY = "wp-integration-pending-provider";

/** Called by the marketplace immediately before it navigates to the provider. */
export function rememberPendingProvider(provider: string) {
  try {
    sessionStorage.setItem(PROVIDER_KEY, provider);
  } catch {
    // Private-mode or storage-disabled browsers: the callback falls back to an explicit error
    // rather than guessing a provider and binding the wrong account.
  }
}

export function IntegrationsCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // React strict-mode mounts effects twice in dev, and an OAuth code is single-use — a second
  // exchange would fail against a code the first call already consumed and show a false error.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    const state = params.get("state");
    // The provider reports a refusal here too — the user pressed Cancel, or an admin policy blocked
    // the install. That is not an error worth a stack trace; it just means "nothing happened".
    const denied = params.get("error");
    let provider: string | null = null;
    try {
      provider = sessionStorage.getItem(PROVIDER_KEY);
      sessionStorage.removeItem(PROVIDER_KEY);
    } catch {
      provider = null;
    }

    if (denied) {
      setError("The connection was cancelled — nothing has changed.");
      return;
    }
    if (!code || !state) {
      setError("That link is missing information. Start the connection again.");
      return;
    }
    if (!provider) {
      setError(
        "We lost track of which app you were connecting. Start the connection again.",
      );
      return;
    }

    completeConnect(provider, code, state)
      .then(() => {
        setDone(true);
        router.replace("/settings/integrations?connected=1");
      })
      .catch((e) => {
        setError(
          e instanceof ApiError
            ? e.message
            : "We couldn't finish the connection. Start again.",
        );
      });
  }, [params, router]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="Connection not completed"
          description={error}
          action={
            <Button onClick={() => router.replace("/settings/integrations")}>
              Back to Integrations
            </Button>
          }
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={CheckCircle2}
          title="Connected"
          description="Taking you back to Integrations…"
        />
      </div>
    );
  }

  return <Loader label="Finishing the connection…" />;
}
