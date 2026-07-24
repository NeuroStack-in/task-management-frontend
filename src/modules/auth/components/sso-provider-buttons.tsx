"use client";

/**
 * Inline social sign-in buttons — shown directly on the login / signup pages. Google and Microsoft
 * redirect to the Cognito Hosted UI pinned to that provider.
 *
 * Social sign-in is **invited-users-only** (linked by verified email on the backend) — an uninvited
 * identity is rejected there, not here.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { GoogleIcon, MicrosoftIcon } from "@/modules/marketing/brand-icons";
import { beginSso } from "@/lib/oauth";

export function SsoProviderButtons({
  disabled,
  onError,
}: {
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<"google" | "microsoft" | null>(null);

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
    </div>
  );
}
