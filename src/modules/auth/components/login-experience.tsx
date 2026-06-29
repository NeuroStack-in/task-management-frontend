"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { AuthError, DEMO_EMAIL } from "@/modules/auth/services/auth.service";
import { Logo } from "@/modules/marketing/logo";
import { GoogleIcon, MicrosoftIcon } from "@/modules/marketing/brand-icons";

type Status = "idle" | "loading" | "success";

export function LoginExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  // Per-field errors so every problem shows at once; `form` is a top-level
  // auth failure (e.g. unknown account) returned by the login service.
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fe: { email?: string; password?: string } = {};
    if (!email.trim()) fe.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      fe.email = "Enter a valid email address.";
    if (!password) fe.password = "Enter your password.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setStatus("loading");
    try {
      await login(email.trim(), password);
      setStatus("success");
      const from = params.get("from");
      setTimeout(
        () => router.replace(from && from.startsWith("/") ? from : "/dashboard"),
        650,
      );
    } catch (err) {
      setStatus("idle");
      setError(err instanceof AuthError ? err.message : "Something went wrong.");
    }
  };

  const onReset = (e: React.FormEvent) => {
    e.preventDefault();
    const fe: { email?: string } = {};
    if (!email.trim()) fe.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      fe.email = "Enter a valid email address.";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;
    setSent(true);
  };

  return (
    <div className="m-root relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* Aurora backdrop */}
      <div className="m-aurora" aria-hidden style={{ opacity: 0.35 }}>
        <span
          style={{
            width: "44vw",
            height: "44vw",
            left: "6%",
            top: "4%",
            background: "var(--m-accent)",
            animation: "m-drift-a 28s ease-in-out infinite",
          }}
        />
        <span
          style={{
            width: "40vw",
            height: "40vw",
            right: "2%",
            bottom: "0%",
            background: "var(--m-accent-2)",
            animation: "m-drift-b 32s ease-in-out infinite",
          }}
        />
      </div>

      {/* Card — scale-up entrance */}
      <div
        className="m-card m-enter-scale relative z-10 w-full max-w-[440px] p-8 sm:p-10"
        style={{ boxShadow: "0 40px 80px -40px rgb(0 0 0 / 0.6)" }}
      >
        <Link href="/" className="inline-block">
          <Logo />
        </Link>

        {mode === "signin" ? (
          <form onSubmit={onSignin} className="mt-7">
            <h1 className="m-display text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--m-muted)" }}>
              Sign in to pick up where your team left off.
            </p>

            <div className="mt-7 space-y-4">
              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                error={fieldErr.email}
              />
              <div>
                <Field
                  id="password"
                  label="Password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  error={fieldErr.password}
                  toggle={
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="m-field-toggle"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      <span className="grid transition-transform duration-200" style={{ transform: showPw ? "rotateY(180deg)" : "none" }}>
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </span>
                    </button>
                  }
                />
                <div className="mt-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                      setFieldErr({});
                    }}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--m-accent-ink)" }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <p
                className="mt-3 text-xs"
                style={{ color: "var(--m-danger)" }}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status !== "idle"}
              className="m-btn m-btn-primary mt-6 w-full"
              style={
                status === "success"
                  ? { background: "var(--m-success)" }
                  : undefined
              }
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="m-spin size-4" /> Signing in…
                </>
              ) : status === "success" ? (
                <>
                  <Check className="size-4" /> Welcome!
                </>
              ) : (
                "Log in"
              )}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
              <span className="text-xs" style={{ color: "var(--m-muted)" }}>
                or continue with
              </span>
              <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button type="button" className="m-social" aria-label="Continue with Google">
                <GoogleIcon /> Google
              </button>
              <button type="button" className="m-social" aria-label="Continue with Microsoft">
                <MicrosoftIcon /> Microsoft
              </button>
              <button
                type="button"
                className="m-social sm:col-span-2"
                aria-label="Continue with SAML or enterprise single sign-on"
              >
                <KeyRound className="size-[18px]" /> SAML / Enterprise SSO
              </button>
            </div>

            <p className="mt-6 text-center text-xs" style={{ color: "var(--m-muted)" }}>
              Demo:{" "}
              <button
                type="button"
                onClick={() => {
                  setEmail(DEMO_EMAIL);
                  setPassword("demo1234");
                }}
                className="font-medium hover:underline"
                style={{ color: "var(--m-accent-ink)" }}
              >
                {DEMO_EMAIL}
              </button>{" "}
              · any password
            </p>

            <p className="mt-4 text-center text-sm" style={{ color: "var(--m-muted)" }}>
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium hover:underline"
                style={{ color: "var(--m-text)" }}
              >
                Sign up
              </Link>
            </p>
          </form>
        ) : (
          /* Reset — cross-fades in place, no navigation */
          <form onSubmit={onReset} className="m-enter-up mt-7">
            <h1 className="m-display text-2xl font-semibold">
              {sent ? "Check your inbox" : "Reset password"}
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: "var(--m-muted)" }}>
              {sent
                ? `If an account exists for ${email}, a reset link is on its way.`
                : "Enter your email and we'll send a reset link."}
            </p>

            {!sent ? (
              <>
                <div className="mt-7">
                  <Field
                    id="reset-email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    error={fieldErr.email}
                  />
                </div>
                <button type="submit" className="m-btn m-btn-primary mt-6 w-full">
                  Send reset link
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setSent(false);
                setError(null);
                setFieldErr({});
              }}
              className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline"
              style={{ color: "var(--m-muted)" }}
            >
              <ArrowLeft className="size-4" /> Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* Floating-label field */
function Field({
  id,
  label,
  type,
  value,
  onChange,
  error,
  toggle,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  toggle?: React.ReactNode;
}) {
  return (
    <div>
      <div className={`m-field ${error ? "m-error" : ""}`}>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          autoComplete={type === "password" ? "current-password" : "email"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          style={toggle ? { paddingRight: "44px" } : undefined}
        />
        <label htmlFor={id}>{label}</label>
        {toggle}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
