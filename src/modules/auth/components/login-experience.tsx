"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import {
  AuthError,
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
} from "@/modules/auth/services/auth.service";
import {
  AuthCard,
  AuthCardHeader,
  AuthField,
  AuthFrame,
  CardSwitch,
  Divider,
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  // SSO is simulated: any provider signs in as the demo owner and lands on the
  // dashboard, mirroring the sign-up flow's SSO handling.
  const ssoSignIn = async (providerLabel: string) => {
    setSso(null);
    setError(null);
    setStatus("loading");
    try {
      await login(DEMO_ACCOUNTS[0].email, DEMO_PASSWORD);
      setStatus("success");
      toast.success(`Signed in with ${providerLabel}`, {
        description: "Simulated SSO — demo only.",
      });
      const from = params.get("from");
      setTimeout(
        () => router.replace(from && from.startsWith("/") ? from : "/dashboard"),
        650,
      );
    } catch {
      setStatus("idle");
      setError("SSO sign-in failed. Try a demo login below.");
    }
  };

  const onSsoPick = (provider: "google" | "microsoft" | "saml") => {
    setSsoOpen(false);
    if (provider === "saml") ssoSignIn("SAML SSO");
    else setSso(provider);
  };

  if (hydrated && isAuthenticated) return null;

  return (
    <>
    <AuthFrame maxWidth={404}>
      <AuthCard>
        {!reset ? (
          <form onSubmit={onSignin}>
            <AuthCardHeader
              title="Welcome back"
              subtitle="Sign in to pick up where your team left off."
            />

            <div className="space-y-3">
              <AuthField
                id="email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Email"
                error={!!error}
                autoComplete="email"
              />
              <div>
                <AuthField
                  id="password"
                  icon={Lock}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="Password"
                  error={!!error}
                  autoComplete="current-password"
                  toggle={<PwToggle show={showPw} onClick={() => setShowPw((s) => !s)} />}
                />
                <div className="mt-1.5 text-right">
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
              </div>
            </div>

            {error ? (
              <p className="mt-2 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status !== "idle"}
              className="m-btn m-btn-primary mt-4 w-full"
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

            <Divider />

            <button
              type="button"
              onClick={() => {
                setError(null);
                setSsoOpen(true);
              }}
              disabled={status !== "idle"}
              className="m-btn m-btn-ghost w-full"
            >
              <KeyRound className="size-[18px]" /> Continue with SSO
            </button>

            <div className="mt-4 text-center text-xs" style={{ color: "var(--m-muted)" }}>
              <p className="mb-2">Demo logins · any password</p>
              <div className="flex flex-wrap justify-center gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className="rounded-full border px-3.5 py-1 text-xs font-semibold transition-[filter] hover:brightness-95"
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
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="Email"
                  error={!!error}
                />
                {error ? (
                  <p className="mt-2 text-xs" style={{ color: "var(--m-danger)" }}>
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="m-btn m-btn-primary mt-4 w-full">
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
