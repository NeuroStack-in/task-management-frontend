"use client";

/**
 * Answers the real Cognito TOTP challenge (`SOFTWARE_TOKEN_MFA`). The login page stashes the
 * half-authenticated `CognitoUser` in the auth service and routes here; that state is in-memory
 * only, so a hard refresh on this page loses the challenge — we detect that and send the user
 * back to sign in.
 *
 * UX audit 2026-10-16:
 * - **ONB-09** — on the shared auth primitives: no app card nested inside the auth card, a real
 *   label, `aria-invalid`/`aria-describedby`, and a wrong code reported in the focused error summary
 *   rather than a toast that disappeared (ONB-10).
 * - **ONB-11** — one input with `autocomplete="one-time-code"` instead of six digit boxes, so the
 *   platform's code autofill and a paste both work, and a screen reader hears one field. And a way
 *   forward when the authenticator is gone: "Can't use your app?" says what actually recovers the
 *   account. There are no backup codes; an owner or admin (anyone with `security:manage`) can turn a
 *   member's authenticator off with `POST /v1/users/{id}/mfa/reset`, after which the password alone
 *   signs them in. Nobody outside the organization can, so a sole owner has no in-product recovery —
 *   the copy says so rather than inventing a path.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { AuthError, hasPendingTotpChallenge } from "@/modules/auth/services/auth.service";
import { currentRoleSnapshot } from "@/hooks/use-permissions";
import { safeLandingPath } from "@/lib/rbac";
import { AuthBackLink, AuthErrorSummary, AuthField, AuthHeading } from "./auth-frame";

const LENGTH = 6;
const CODE_ID = "mfa-code";

export function MfaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const completeMfa = useAuthStore((s) => s.completeMfa);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  /** The challenge itself is gone (expired, too many tries) — only a fresh sign-in helps now. */
  const [challengeGone, setChallengeGone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read once on first render — the challenge only appears via a login redirect, never later.
  const [hasChallenge] = useState(() => hasPendingTotpChallenge());

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (code.length !== LENGTH) {
      setError(`Enter the ${LENGTH}-digit code from your authenticator app`);
      focusSummary();
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await completeMfa(code);
      router.replace(safeLandingPath(currentRoleSnapshot(), params.get("from")));
    } catch (err) {
      const isRetryable = err instanceof AuthError && err.kind === "credentials";
      if (isRetryable) {
        // Wrong code — the challenge is still live; clear the field for another attempt and keep
        // the reason on screen until they type again.
        setError("That code didn't match. Wait for the next code in your app, then enter it.");
        setCode("");
        setSubmitting(false);
        focusSummary();
      } else {
        // The challenge itself is gone (expired, or too many tries): only a fresh sign-in helps.
        setChallengeGone(true);
        setError(
          err instanceof AuthError
            ? `${err.message} Sign in again to get a new verification prompt.`
            : "Verification didn't go through. Sign in again to get a new verification prompt.",
        );
        setSubmitting(false);
        focusSummary();
      }
    }
  };

  if (!hasChallenge) {
    return (
      <>
        {/* Real headings — these titles were styled divs (QA audit 2026-10-08, WP-368). */}
        <AuthHeading
          title="Verification expired"
          subtitle="This page only works right after entering your password. Sign in again to get a new verification prompt."
        />
        <Link href="/login" className="m-btn m-btn-primary mt-2 w-full">
          Back to sign in
        </Link>
        <LostAuthenticator />
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title="Two-step verification"
        subtitle="Enter the 6-digit code from your authenticator app."
      />
      <form onSubmit={verify} noValidate>
        <AuthErrorSummary errors={error ? [[CODE_ID, error]] : []} summaryRef={summaryRef} />
        <AuthField
          id={CODE_ID}
          label="Verification code"
          hint="The code changes every 30 seconds — if one doesn't match, wait for the next."
          value={code}
          onChange={(v) => {
            setCode(v.replace(/\D/g, "").slice(0, LENGTH));
            if (error) setError(undefined);
          }}
          error={error}
          inputRef={inputRef}
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={LENGTH}
          autoFocus
          disabled={submitting}
          className="m-authinput m-authinput--code"
        />
        {challengeGone ? (
          <Link href="/login" className="m-btn m-btn-primary mt-4 w-full">
            Sign in again
          </Link>
        ) : (
          <button type="submit" disabled={submitting} className="m-btn m-btn-primary mt-4 w-full">
            {submitting ? (
              <>
                <Loader2 className="m-spin size-4" /> Verifying…
              </>
            ) : (
              "Verify"
            )}
          </button>
        )}
      </form>
      <LostAuthenticator />
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
    </>
  );
}

/**
 * "Can't use your app?" — the real recovery path, and its limits (UX audit ONB-11). A native
 * `<details>`, so it works by keyboard and is announced as expandable with no script.
 */
function LostAuthenticator() {
  return (
    <details className="m-adisclose">
      <summary>Can&apos;t use your authenticator app?</summary>
      <div className="m-adisclose__body">
        <p>
          WorkPulse doesn&apos;t have backup codes yet. Instead,{" "}
          <strong>ask an owner or admin in your organization to reset your two-step sign-in</strong>{" "}
          (Settings → Security → &ldquo;Reset a member&apos;s authenticator&rdquo;). After that you sign
          in with your password alone, and can set up a new authenticator in Settings → Login &amp;
          security.
        </p>
        <p>
          <strong>If you&apos;re the only owner or admin,</strong> nobody in your organization can
          reset it, and there&apos;s no self-service recovery yet. Check whether your authenticator
          app can restore its codes from a backup or another device (most can) — and once you&apos;re
          back in, give a second person the Admin role so a lost phone can&apos;t lock the
          organization out.
        </p>
      </div>
    </details>
  );
}
