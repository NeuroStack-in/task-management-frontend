"use client";

/**
 * Sign in.
 *
 * Decisions here are evidence-led rather than conventional; the non-obvious ones:
 *
 * - **`autocomplete="username"` on the email field, not `email`.** Counter-intuitive, but it is
 *   what password managers key on for a sign-in form. `webauthn` is appended so the field is ready
 *   for conditional-mediation passkeys later without another markup change.
 * - **No placeholders.** There is no format hint worth giving for an email or a password, and a
 *   placeholder that doubles as a label disappears exactly when someone needs it.
 * - **Validation timing:** silent while typing, checked on blur only if the field has content,
 *   cleared live once corrected, everything re-checked on submit. Validating an empty field on blur
 *   punishes someone tabbing toward their password manager.
 * - **One failure message for every cause.** "Your email or password is incorrect" whether the
 *   account is absent or the password is wrong — anything more specific is an account-enumeration
 *   oracle. (The server is the real boundary here; this is the message we choose to render.)
 * - **The password is never repopulated after a failed attempt.**
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { AuthError, DEMO_ACCOUNTS } from "@/modules/auth/services/auth.service";
import {
  AuthErrorSummary,
  AuthField,
  AuthFrame,
  AuthHeading,
  AuthPasswordField,
  AuthSwitch,
} from "./auth-frame";
import { SsoOptionsModal, SsoPickerModal } from "./auth-modals";

type Status = "idle" | "loading" | "success";
type Errors = { email?: string; password?: string; form?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [sso, setSso] = useState<"google" | "microsoft" | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);

  /**
   * Prefill after creating a workspace or accepting an invite — both redirect here with `?email=`.
   *
   * Seeded in an effect rather than as lazy `useState` initial state: the server renders this page
   * without the query string, so initialising from `params` there produces markup the client
   * immediately disagrees with, and React reports a hydration mismatch. Setting it post-mount keeps
   * both renders identical.
   */
  useEffect(() => {
    const seeded = params.get("email");
    if (seeded) setEmail(seeded);
  }, [params]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
    }
  }, [hydrated, isAuthenticated, params, router]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!email.trim()) e.email = "Enter your work email";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter an email address in the correct format, like name@company.com";
    if (!password) e.password = "Enter your password";
    return e;
  };

  /** On blur: only complain about a field the user actually put something in. */
  const blurCheck = (field: "email" | "password") => () => {
    const value = field === "email" ? email : password;
    if (!value.trim()) return;
    const next = validate();
    setErrors((prev) => ({ ...prev, [field]: next[field] }));
  };

  /** Live-clear: an error must disappear the moment the input becomes valid. */
  const change = (field: "email" | "password") => (v: string) => {
    if (field === "email") setEmail(v);
    else setPassword(v);
    if (errors[field] || errors.form) {
      setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
    }
  };

  const onSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setErrors({});
    setStatus("loading");
    try {
      await login(email.trim(), password);
      setStatus("success");
      const from = params.get("from");
      setTimeout(() => router.replace(from && from.startsWith("/") ? from : "/dashboard"), 600);
    } catch (err) {
      setStatus("idle");
      // Never leave a rejected password in the field.
      setPassword("");
      // `state` errors describe an account the user can't otherwise get past; everything else
      // collapses to one message so the page never confirms whether an address has an account.
      setErrors({
        form:
          err instanceof AuthError && err.kind === "state"
            ? err.message
            : "Your email or password is incorrect.",
      });
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  // SSO can't be faked: auth is a real Cognito exchange and the pool has no federated providers
  // (enterprise SSO is a proposal, not a shipped feature). Say so rather than signing someone in.
  const ssoSignIn = (providerLabel: string) => {
    setSso(null);
    setStatus("idle");
    setErrors({ form: `${providerLabel} isn't available yet — sign in with your email and password.` });
  };

  if (hydrated && isAuthenticated) return null;

  const summary: [string, string][] = [
    ...(errors.email ? ([["login-email", errors.email]] as [string, string][]) : []),
    ...(errors.password ? ([["login-password", errors.password]] as [string, string][]) : []),
    ...(errors.form ? ([["login-email", errors.form]] as [string, string][]) : []),
  ];

  return (
    <>
      <AuthFrame
        headline="Run your whole workforce"
        headlineAccent="on one calm pulse"
        copy="WorkPulse unifies time, attendance, activity and projects into a single clear signal — so the whole team knows where the work stands."
      >
        <AuthHeading title="Welcome back" subtitle="Sign in to pick up where your team left off." />

        <form onSubmit={onSignin} noValidate>
          {submitted ? <AuthErrorSummary errors={summary} summaryRef={summaryRef} /> : null}

          <AuthField
            id="login-email"
            label="Work email"
            type="email"
            value={email}
            onChange={change("email")}
            onBlur={blurCheck("email")}
            error={errors.email}
            autoComplete="username webauthn"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={status !== "idle"}
          />

          <AuthPasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={change("password")}
            onBlur={blurCheck("password")}
            error={errors.password}
            autoComplete="current-password"
            disabled={status !== "idle"}
          />

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4">
            {/* "Remember me" reads as "remember my username" to most people. Naming the device and
                the effect is clearer — and it matters more here than on most SaaS, because
                workforce tools get used on shared back-office and shop-floor machines. */}
            <label className="m-check">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                aria-describedby="keep-note"
              />
              <span className="m-check__text">
                Keep me signed in on this device
                <span className="m-check__note" id="keep-note">
                  Don&apos;t use this on a shared or public computer.
                </span>
              </span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium underline underline-offset-2"
              style={{ color: "var(--m-accent-ink)" }}
            >
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={status !== "idle"} className="m-btn m-btn-primary mt-4 w-full">
            {status === "loading" ? (
              <>
                <Loader2 className="m-spin size-4" /> Signing in…
              </>
            ) : status === "success" ? (
              "Welcome back!"
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* SSO below the primary action. Kept outside the <form> so it can never be caught by an
            Enter keypress in a field — it isn't a submit path. */}
        <div className="m-authdiv">or</div>

        <button
          type="button"
          onClick={() => {
            setErrors({});
            setSsoOpen(true);
          }}
          disabled={status !== "idle"}
          className="m-btn m-btn-ghost w-full"
        >
          <KeyRound className="size-4" /> Continue with SSO
        </button>

        <AuthSwitch prompt="Don't have an account?" href="/register" label="Create a workspace" />

        {DEMO_ACCOUNTS.length > 0 ? (
          <p className="mt-3 text-center text-xs" style={{ color: "var(--m-faint)" }}>
            Seeded account ·{" "}
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className="underline underline-offset-2"
              >
                {a.email}
              </button>
            ))}{" "}
            · real password required
          </p>
        ) : null}
      </AuthFrame>

      {/* `SsoOptionsModal` is the provider chooser; `SsoPickerModal` is the account chooser that
          follows it. Easy to transpose — the names read the other way round. */}
      <SsoOptionsModal
        open={ssoOpen}
        onClose={() => setSsoOpen(false)}
        onPick={(provider) => {
          setSsoOpen(false);
          if (provider === "saml") ssoSignIn("SAML SSO");
          else setSso(provider);
        }}
      />
      <SsoPickerModal
        provider={sso}
        onClose={() => setSso(null)}
        onPicked={() => ssoSignIn(sso === "google" ? "Google" : "Microsoft")}
      />
    </>
  );
}
