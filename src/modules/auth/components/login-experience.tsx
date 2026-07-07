"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import {
  AuthError,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
} from "@/modules/auth/services/auth.service";
import Image from "next/image";
import { Logo } from "@/modules/marketing/logo";

type Status = "idle" | "loading" | "success";

export function LoginExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Already signed in (e.g. arrived here via the browser back button)? Send them
  // to the app instead of the login form — going back shouldn't feel like a logout.
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
    }
  }, [hydrated, isAuthenticated, params, router]);

  const onSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
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
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setSent(true);
  };

  // Redirect in flight — don't flash the login form to a signed-in user.
  if (hydrated && isAuthenticated) return null;

  return (
    <div className="m-root min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: immersive brand panel ── */}
      <aside
        className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14"
        style={{
          background:
            "radial-gradient(120% 90% at 12% 8%, rgba(47,157,146,0.42), transparent 52%)," +
            "radial-gradient(110% 90% at 92% 96%, rgba(15,118,110,0.55), transparent 58%)," +
            "linear-gradient(160deg, #07100f 0%, #0a1a18 55%, #071312 100%)",
        }}
      >
        {/* Full-bleed wave artwork with a left scrim for headline legibility */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/logindesign01.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 0px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(6,15,14,0.82) 0%, rgba(6,15,14,0.4) 40%, rgba(6,15,14,0.05) 72%, transparent 100%)",
            }}
          />
        </div>
        {/* Top — brand */}
        <Link
          href="/"
          className="m-enter-up relative z-10 inline-flex w-fit text-white"
          style={{ animationDelay: "60ms" }}
        >
          <Logo />
        </Link>

        {/* Middle — headline */}
        <div
          className="m-enter-left relative z-10 max-w-md"
          style={{ animationDelay: "160ms" }}
        >
          <h2 className="m-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
            Your workforce,
            <br />
            in perfect rhythm.
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
            Time, attendance, tasks, and productivity — one calm place for the
            whole team, from first clock-in to payroll-ready timesheets.
          </p>
        </div>

        {/* Spacer keeps the headline vertically centred in the panel */}
        <div aria-hidden />
      </aside>

      {/* ── Right: auth form ── */}
      <main
        className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10"
        style={{ background: "var(--m-bg)" }}
      >
        <div
          className="m-enter-right w-full max-w-[400px]"
          style={{ animationDelay: "120ms" }}
        >
          {/* Logo shown here on small screens (left panel hidden) */}
          <Link href="/" className="mb-9 inline-flex lg:hidden">
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
                error={!!error}
              />
              <div>
                <Field
                  id="password"
                  label="Password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  error={!!error}
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
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
              <span className="text-xs" style={{ color: "var(--m-muted)" }}>
                or
              </span>
              <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
            </div>

            {/* SSO entry (matches the sign-up page) */}
            <button type="button" className="m-btn m-btn-ghost w-full">
              <KeyRound className="size-[18px]" /> Continue with SSO
            </button>

            <div className="mt-6 text-center text-xs" style={{ color: "var(--m-muted)" }}>
              <p className="mb-2">Demo logins · any password</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => {
                      setEmail(acct.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className="rounded-full border px-3 py-1 font-medium transition-colors hover:bg-black/5"
                    style={{
                      borderColor: "var(--m-border)",
                      color: "var(--m-accent-ink)",
                    }}
                    title={acct.hint}
                  >
                    {acct.label}
                  </button>
                ))}
              </div>
            </div>

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
                    error={!!error}
                  />
                </div>
                {error ? (
                  <p className="mt-3 text-xs" style={{ color: "var(--m-danger)" }}>
                    {error}
                  </p>
                ) : null}
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
              }}
              className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline"
              style={{ color: "var(--m-muted)" }}
            >
              <ArrowLeft className="size-4" /> Back to sign in
            </button>
          </form>
        )}
        </div>
      </main>
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
  error?: boolean;
  toggle?: React.ReactNode;
}) {
  return (
    <div className={`m-field ${error ? "m-error" : ""}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        autoComplete={type === "password" ? "current-password" : "email"}
        style={toggle ? { paddingRight: "44px" } : undefined}
      />
      <label htmlFor={id}>{label}</label>
      {toggle}
    </div>
  );
}
