"use client";

/**
 * Step 1 of the real Cognito reset flow: request a verification code by email. On success we hand
 * off to `/reset-password` (the email travels in `sessionStorage`) where the code + new password are
 * entered — that page calls `confirmPassword`. The two steps are separate routes so a refresh
 * mid-flow is harmless.
 *
 * Built on the same field primitives as sign-in and sign-up (UX audit 2026-10-16, ONB-09). It used to
 * nest an app `Card` inside the auth card, carried a placeholder the auth styles forbid, and showed
 * errors as bare red text with no `aria-invalid`/`aria-describedby` — and a refused request was a
 * toast that vanished in four seconds without taking focus (ONB-10). Errors now land in the focused
 * summary at the top of the card and stay there until the field changes.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { requestPasswordReset, AuthError } from "@/modules/auth/services/auth.service";
import { handOffEmail } from "@/modules/auth/email-handoff";
import { AuthBackLink, AuthErrorSummary, AuthField, AuthHeading } from "./auth-frame";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  /** A refusal from the server — not the field's fault, so it isn't marked on the field. */
  const [serverError, setServerError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const validate = (v: string): string | undefined => {
    if (!v.trim()) return "Enter your email address";
    if (!EMAIL_RE.test(v.trim()))
      return "Enter an email address in the correct format, like name@company.com";
    return undefined;
  };

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(email);
    setError(found);
    setServerError(undefined);
    if (found) {
      focusSummary();
      return;
    }
    setSubmitting(true);
    try {
      const address = email.trim().toLowerCase();
      await requestPasswordReset(address);
      // Not as `?email=`: an address in the URL lands in history and access logs (WP-390). The next
      // page says where the code went, so no toast is needed here.
      handOffEmail(address);
      router.push("/reset-password");
    } catch (err) {
      setServerError(
        err instanceof AuthError ? err.message : "Couldn't send a reset code. Please try again.",
      );
      setSubmitting(false);
      focusSummary();
    }
  };

  const summary: [string, string][] = [
    ...(error ? ([["fp-email", error]] as [string, string][]) : []),
    ...(serverError ? ([["", serverError]] as [string, string][]) : []),
  ];

  return (
    <>
      <AuthHeading
        title="Forgot your password?"
        subtitle="Enter the email you sign in with and we'll send you a code to set a new one."
      />
      <form method="post" onSubmit={onSubmit} noValidate>
        <AuthErrorSummary errors={summary} summaryRef={summaryRef} />
        <AuthField
          id="fp-email"
          label="Work email"
          type="email"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError(undefined);
            if (serverError) setServerError(undefined);
          }}
          onBlur={() => {
            if (email.trim()) setError(validate(email));
          }}
          error={error}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting} className="m-btn m-btn-primary mt-4 w-full">
          {submitting ? (
            <>
              <Loader2 className="m-spin size-4" /> Sending…
            </>
          ) : (
            "Send reset code"
          )}
        </button>
      </form>
      <p className="m-anote">
        Sign in with Google? Use Continue with Google on the sign-in page instead — a reset code
        only works for an email-and-password account.
      </p>
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
    </>
  );
}
