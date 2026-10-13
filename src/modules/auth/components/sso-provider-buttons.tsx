"use client";

/**
 * Inline social sign-in button — shown directly on the login / signup pages. Redirects to the
 * Cognito Hosted UI pinned to Google.
 *
 * **Google is the only social provider** (owner decision, 2026-09-30). Microsoft was offered here
 * and was removed rather than left disabled: a provider button that cannot complete is worse than
 * its absence, because someone picks it, fails, and concludes their account is broken.
 *
 * What happens is decided on the backend (the Cognito pre-sign-up trigger): an address it can prove
 * belongs to an existing account signs in to that account; an address WorkPulse doesn't know gets an
 * account with no organization, which goes on to request one from /onboarding; anything it can't
 * prove is refused.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleIcon } from "@/modules/marketing/brand-icons";
import { beginSso } from "@/lib/oauth";

export function SsoProviderButtons({
  disabled,
  onError,
}: {
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    onError("");
    setBusy(true);
    try {
      await beginSso("Google"); // navigates away
    } catch {
      setBusy(false);
      onError("SSO isn't configured yet. Sign in with your email and password.");
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={signIn}
        disabled={busy || disabled}
        className="m-btn m-btn-ghost w-full"
      >
        {busy ? <Loader2 className="m-spin size-4" /> : <GoogleIcon className="size-5" />}
        Continue with Google
      </button>
    </div>
  );
}
