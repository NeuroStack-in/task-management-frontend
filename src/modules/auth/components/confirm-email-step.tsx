"use client";

/**
 * The email sign-up's last stage: type the code Cognito emailed, and the workspace request goes in.
 *
 * Email sign-ups now wait for staff approval like Google ones (owner decision 2026-10-17, UX audit
 * ONB-01), so the email path creates only a login first — and a login has to prove its address
 * before it can sign in. The host does the rest on confirm (sign in, submit the request, open the
 * waiting screen).
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthError } from "@/modules/auth/services/auth.service";
import { AuthField, AuthFrame, AuthHeading } from "./auth-frame";

export function ConfirmEmailStep({
  email,
  onConfirm,
  onResend,
}: {
  email: string;
  onConfirm: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function confirm() {
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(code);
    } catch (e) {
      setError(
        e instanceof AuthError
          ? e.message
          : "Couldn't confirm your email. Please try again.",
      );
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await onResend();
      toast.success("A new code is on its way", { description: email });
    } catch (e) {
      toast.error(
        e instanceof AuthError
          ? e.message
          : "Couldn't send a new code. Please try again.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthFrame
      headline="Set your organization"
      headlineAccent="in motion today"
      copy="One last step: confirm your email, and your workspace request goes to the WorkPulse team."
    >
      <AuthHeading
        title="Check your email"
        subtitle={`We sent a 6-digit code to ${email}. Enter it to confirm your address and send your workspace request.`}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
        noValidate
      >
        <AuthField
          id="signup-code"
          label="Confirmation code"
          value={code}
          onChange={(v) => {
            setCode(v.replace(/[^\d]/g, "").slice(0, 6));
            setError(undefined);
          }}
          error={error}
          autoComplete="one-time-code"
          inputMode="numeric"
          hint="It can take a minute to arrive. Check your spam folder too."
        />
        <div className="m-authactions">
          <button type="submit" className="m-btn m-btn-primary flex-1" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="m-spin size-4" /> Sending your request…
              </>
            ) : (
              "Confirm and send request"
            )}
          </button>
        </div>
      </form>
      <p className="m-anote">
        No email?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="font-semibold underline underline-offset-2"
          style={{ color: "var(--m-accent-ink)" }}
        >
          {resending ? "Sending…" : "Send a new code"}
        </button>
      </p>
    </AuthFrame>
  );
}
