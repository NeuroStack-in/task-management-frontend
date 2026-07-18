"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, KeyRound, Loader2, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { AuthError, DEMO_ACCOUNTS } from "@/modules/auth/services/auth.service";
import {
  AuthCard,
  AuthCardHeader,
  AuthField,
  AuthFrame,
  CardSwitch,
  PwToggle,
} from "./auth-frame";
import { SsoOptionsModal, SsoPickerModal } from "./auth-modals";

type Status = "idle" | "loading" | "success";

export function LoginExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Prefilled when we already know who's arriving — straight after creating a workspace or
  // accepting an invite, both of which redirect here with `?email=`.
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [sso, setSso] = useState<"google" | "microsoft" | null>(null);

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

  // SSO can no longer be faked: auth is a real Cognito SRP exchange, and the pool has no federated
  // identity providers (enterprise SSO is cut from scope — LLD "Cut from scope"). Say so plainly
  // instead of signing the user in as somebody else.
  const ssoSignIn = (providerLabel: string) => {
    setSso(null);
    setStatus("idle");
    setError(`${providerLabel} isn't available — sign in with your email and password.`);
  };

  const onSsoPick = (provider: "google" | "microsoft" | "saml") => {
    setSsoOpen(false);
    if (provider === "saml") ssoSignIn("SAML SSO");
    else setSso(provider);
  };

  if (hydrated && isAuthenticated) return null;

  return (
    <>
    <AuthFrame
      headline="Your workforce, in perfect rhythm."
      copy="Time, attendance, tasks, and productivity — one calm place for the whole team, from first clock-in to payroll-ready timesheets."
      maxWidth={440}
    >
      <AuthCard>
        {!reset ? (
          <form onSubmit={onSignin}>
            <AuthCardHeader
              title="Welcome back"
              subtitle="Sign in to pick up where your team left off."
            />

            <div className="space-y-4">
              <AuthField
                id="email"
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                error={!!error}
                autoComplete="email"
              />
              <AuthField
                id="password"
                label="Password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                error={!!error}
                autoComplete="current-password"
                toggle={<PwToggle show={showPw} onClick={() => setShowPw((s) => !s)} />}
              />
            </div>

            {/* Remember · Forgot */}
            <div className="mt-3.5 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <span
                  className="flex size-[16px] items-center justify-center rounded-[4px] border transition-colors"
                  style={{
                    borderColor: remember ? "var(--m-accent)" : "var(--m-border-strong)",
                    background: remember ? "var(--m-accent)" : "transparent",
                    color: "var(--m-on-accent)",
                  }}
                >
                  {remember ? <Check className="size-3" /> : null}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="text-xs" style={{ color: "var(--m-muted)" }}>
                  Remember
                </span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setReset(true);
                  setError(null);
                }}
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--m-accent-ink)" }}
              >
                Forgot password?
              </button>
            </div>

            {error ? (
              <p className="mt-2.5 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status !== "idle"}
              className="m-btn m-btn-primary mt-5 w-full"
              style={status === "success" ? { background: "var(--m-success)" } : undefined}
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

            <button
              type="button"
              onClick={() => {
                setError(null);
                setSsoOpen(true);
              }}
              disabled={status !== "idle"}
              className="m-btn m-btn-ghost mt-2.5 w-full"
            >
              <KeyRound className="size-4" /> Continue with SSO
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs" style={{ color: "var(--m-faint)" }}>
              <span>Seeded account · real password</span>
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => setEmail(a.email)}
                  className="rounded-[6px] border px-3 py-0.5 text-xs font-semibold transition-[filter] hover:brightness-95"
                  style={{
                    borderColor: "color-mix(in srgb, var(--m-accent) 30%, transparent)",
                    background: "var(--m-accent-tint)",
                    color: "var(--m-accent-ink)",
                  }}
                  title={a.hint}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <CardSwitch prompt="Don't have an account?" href="/register" label="Sign up" />
          </form>
        ) : (
          /* Reset password */
          <form onSubmit={onReset}>
            <AuthCardHeader
              title={sent ? "Check your inbox" : "Reset password"}
              subtitle={
                sent
                  ? `A reset link is on its way to ${email}.`
                  : "Enter your email and we'll send a reset link."
              }
            />

            {!sent ? (
              <>
                <AuthField
                  id="reset-email"
                  label="Email"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  error={!!error}
                />
                {error ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--m-danger)" }}>
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="m-btn m-btn-primary mt-5 w-full">
                  Send reset link
                </button>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setReset(false);
                setSent(false);
                setError(null);
              }}
              className="mx-auto mt-5 flex items-center gap-1.5 text-sm hover:underline"
              style={{ color: "var(--m-muted)" }}
            >
              <ArrowLeft className="size-4" /> Back to sign in
            </button>
          </form>
        )}
      </AuthCard>
    </AuthFrame>

      <SsoOptionsModal
        open={ssoOpen}
        onClose={() => setSsoOpen(false)}
        onPick={onSsoPick}
      />
      <SsoPickerModal
        provider={sso}
        onClose={() => setSso(null)}
        onPicked={() => ssoSignIn(sso === "google" ? "Google" : "Microsoft")}
      />
    </>
  );
}
