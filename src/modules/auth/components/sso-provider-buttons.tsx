"use client";

/**
 * Inline SSO provider buttons — shown directly on the login / signup pages (no modal). Real, not a
 * demo: Google/Microsoft redirect to the Cognito Hosted UI pinned to that provider; "Enterprise SSO"
 * runs email-first discovery and, if the domain is bound to a verified IdP, redirects there.
 *
 * Social sign-in is **invited-users-only** (linked by verified email on the backend) — an uninvited
 * identity is rejected there, not here. Discovery reveals nothing about whether an account exists.
 */
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { GoogleIcon, MicrosoftIcon } from "@/modules/marketing/brand-icons";
import { beginSso } from "@/lib/oauth";
import { discoverSso } from "@/modules/auth/services/sso.service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SsoProviderButtons({
  /** The email currently typed in the form — used to route "Enterprise SSO" to the org's IdP. */
  email,
  disabled,
  onError,
}: {
  email: string;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"google" | "microsoft" | "saml" | null>(null);

  const social = (idp: "Google" | "Microsoft") => async () => {
    onError("");
    setBusy(idp === "Google" ? "google" : "microsoft");
    try {
      await beginSso(idp); // navigates away
    } catch {
      setBusy(null);
      onError("SSO isn't configured yet. Sign in with your email and password.");
    }
  };

  const enterprise = async () => {
    onError("");
    const e = email.trim();
    if (!EMAIL_RE.test(e)) {
      onError("Enter your work email above, then continue with Enterprise SSO.");
      return;
    }
    setBusy("saml");
    try {
      const d = await discoverSso(e);
      if (d.sso && d.idp_name) {
        await beginSso(d.idp_name); // navigates away
        return;
      }
      setBusy(null);
      onError("No enterprise SSO is set up for that email's domain. Sign in with your password.");
    } catch {
      setBusy(null);
      onError("Couldn't check SSO for that domain. Sign in with your password.");
    }
  };

  const anyBusy = busy !== null || disabled;

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={social("Google")}
        disabled={anyBusy}
        className="m-btn m-btn-ghost w-full"
      >
        {busy === "google" ? <Loader2 className="m-spin size-4" /> : <GoogleIcon className="size-5" />}
        Continue with Google
      </button>
      <button
        type="button"
        onClick={social("Microsoft")}
        disabled={anyBusy}
        className="m-btn m-btn-ghost w-full"
      >
        {busy === "microsoft" ? (
          <Loader2 className="m-spin size-4" />
        ) : (
          <MicrosoftIcon className="size-5" />
        )}
        Continue with Microsoft
      </button>
      <button
        type="button"
        onClick={enterprise}
        disabled={anyBusy}
        className="m-btn m-btn-ghost w-full"
      >
        {busy === "saml" ? <Loader2 className="m-spin size-4" /> : <KeyRound className="size-4" />}
        Continue with SAML / Enterprise SSO
      </button>
    </div>
  );
}
