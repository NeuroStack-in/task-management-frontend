"use client";

/**
 * Step 2 of the real Cognito reset flow: enter the emailed code and a new password
 * (`confirmPassword`). The forgot-password step hands the email over in `sessionStorage` — not the
 * URL (WP-390) — and it stays editable so a direct visit (or a typo) still works. "Send a new code"
 * re-triggers `forgotPassword`.
 *
 * On the shared auth field primitives (UX audit 2026-10-16, ONB-09) — no nested app card, no
 * placeholders, `aria-invalid`/`aria-describedby` on every field — with the same live password
 * checklist sign-up shows, so the policy is visible before a failed submit rather than after
 * (ONB-10). A refusal from Cognito (wrong or expired code, a rejected password) lands in the focused
 * error summary, beside the field it's about, and stays until that field changes.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { takeHandedOffEmail, handOffEmail } from "@/modules/auth/email-handoff";
import {
  AuthError,
  confirmPasswordReset,
  requestPasswordReset,
} from "@/modules/auth/services/auth.service";
import {
  AuthBackLink,
  AuthErrorSummary,
  AuthField,
  AuthHeading,
  AuthPasswordField,
  AuthPasswordRules,
  AuthStatus,
  passwordMeetsPolicy,
} from "./auth-frame";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = "email" | "code" | "password" | "confirm";
type Errors = Partial<Record<Field | "form", string>>;

/** Field → input id, which is also the error summary's jump target. */
const IDS: Record<Field, string> = {
  email: "rp-email",
  code: "rp-code",
  password: "rp-password",
  confirm: "rp-confirm",
};

export function ResetPasswordForm() {
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    email: "",
    code: "",
    password: "",
    confirm: "",
  });
  /** The address the previous step sent a code to — only to say so in the subtitle. */
  const [sentTo, setSentTo] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  // In an effect, not initial state: the server render has no sessionStorage (hydration).
  useEffect(() => {
    const handedOff = takeHandedOffEmail();
    if (handedOff) {
      setValues((v) => ({ ...v, email: v.email || handedOff }));
      setSentTo(handedOff);
    }
  }, []);

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  const set = (field: Field) => (v: string) => {
    setValues((s) => ({ ...s, [field]: field === "code" ? v.replace(/\s/g, "") : v }));
    // Live-clear: an error disappears the moment its field changes; a whole-form refusal too.
    if (errors[field] || errors.form) {
      setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
    }
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (!values.email.trim()) e.email = "Enter your email address";
    else if (!EMAIL_RE.test(values.email.trim()))
      e.email = "Enter an email address in the correct format, like name@company.com";
    if (!values.code.trim()) e.code = "Enter the code from your email";
    if (!passwordMeetsPolicy(values.password))
      e.password = "Your new password doesn't meet all the requirements yet";
    if (values.confirm !== values.password) e.confirm = "Both passwords must match";
    return e;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setStatus("");
    if (Object.keys(found).length > 0) {
      focusSummary();
      return;
    }
    setSubmitting(true);
    const email = values.email.trim().toLowerCase();
    try {
      await confirmPasswordReset(email, values.code, values.password);
      toast.success("Password updated", {
        description: "Sign in with your new password.",
      });
      // Prefill the sign-in page — through sessionStorage, never the URL (WP-390).
      handOffEmail(email);
      router.push("/login");
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : "Couldn't reset your password. Check the code and try again — it may have expired.";
      const field = err instanceof AuthError ? err.field : undefined;
      setErrors(field ? { [field]: message } : { form: message });
      // Never leave a refused password sitting in the fields.
      if (field === "password") setValues((v) => ({ ...v, password: "", confirm: "" }));
      setSubmitting(false);
      focusSummary();
    }
  };

  const resend = async () => {
    const email = values.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      setErrors((e) => ({ ...e, email: "Enter your email address first, then send a new code" }));
      focusSummary();
      return;
    }
    setResending(true);
    setStatus("");
    try {
      await requestPasswordReset(email);
      setErrors((e) => ({ ...e, code: undefined, form: undefined }));
      setStatus(`We sent a new code to ${email.toLowerCase()} if it has a WorkPulse account. Codes from earlier emails no longer work.`);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        form: err instanceof AuthError ? err.message : "Couldn't send a new code. Wait a moment and try again.",
      }));
      focusSummary();
    } finally {
      setResending(false);
    }
  };

  const summary = (Object.keys(IDS) as Field[])
    .filter((f) => errors[f])
    .map((f) => [IDS[f], errors[f]!] as [string, string])
    .concat(errors.form ? [["", errors.form]] : []);

  return (
    <>
      <AuthHeading
        title="Set a new password"
        subtitle={
          sentTo
            ? `If ${sentTo} has a WorkPulse account, we've emailed it a code. Enter it below with your new password.`
            : "Enter the code we emailed you and choose a password you don't use anywhere else."
        }
      />
      <form onSubmit={onSubmit} noValidate>
        <AuthErrorSummary errors={summary} summaryRef={summaryRef} />

        <AuthField
          id={IDS.email}
          label="Work email"
          type="email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={submitting}
        />
        <AuthField
          id={IDS.code}
          label="Verification code"
          hint="The 6-digit code in the email. It can take a minute to arrive — check spam too."
          value={values.code}
          onChange={set("code")}
          error={errors.code}
          autoComplete="one-time-code"
          inputMode="numeric"
          disabled={submitting}
        />
        <AuthPasswordField
          id={IDS.password}
          label="New password"
          value={values.password}
          onChange={set("password")}
          error={errors.password}
          autoComplete="new-password"
          disabled={submitting}
        />
        <AuthPasswordField
          id={IDS.confirm}
          label="Confirm new password"
          value={values.confirm}
          onChange={set("confirm")}
          error={errors.confirm}
          autoComplete="new-password"
          disabled={submitting}
        />
        <AuthPasswordRules value={values.password} confirm={values.confirm} showMatch />

        <button type="submit" disabled={submitting} className="m-btn m-btn-primary mt-4 w-full">
          {submitting ? (
            <>
              <Loader2 className="m-spin size-4" /> Updating…
            </>
          ) : (
            "Update password"
          )}
        </button>
      </form>

      <p className="m-anote">
        No code, or it expired?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={resending || submitting}
          className="-my-1 py-1 font-semibold underline underline-offset-2"
          style={{ color: "var(--m-accent-ink)" }}
        >
          {resending ? "Sending…" : "Send a new code"}
        </button>
      </p>
      <AuthStatus>{status}</AuthStatus>
      <AuthBackLink href="/login">Back to sign in</AuthBackLink>
    </>
  );
}
