"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_EMAIL } from "@/modules/auth/services/auth.service";
import {
  OrgSetupModal,
  SsoOptionsModal,
  SsoPickerModal,
} from "@/modules/auth/components/auth-modals";
import {
  AuthCard,
  AuthCardHeader,
  AuthField,
  AuthFrame,
  CardSwitch,
  Divider,
  PwToggle,
} from "./auth-frame";

type AccountErrors = Partial<
  Record<"name" | "email" | "password" | "confirm" | "agree", string>
>;

export function SignupExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [acct, setAcct] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<AccountErrors>({});
  const [showPw, setShowPw] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [sso, setSso] = useState<"google" | "microsoft" | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);

  // Set once we hand off to /onboarding, so the "already authenticated"
  // redirect below doesn't race us straight to /dashboard after login.
  const finishingRef = useRef(false);

  const setA = (k: keyof typeof acct) => (v: string) =>
    setAcct((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (finishingRef.current) return;
    if (hydrated && isAuthenticated) {
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
    }
  }, [hydrated, isAuthenticated, params, router]);

  const submitAccount = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: AccountErrors = {};
    if (acct.name.trim().length < 2) e.name = "Tell us your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acct.email))
      e.email = "Enter a valid work email.";
    if (acct.password.length < 8) e.password = "At least 8 characters.";
    if (acct.confirm !== acct.password) e.confirm = "Passwords don't match.";
    if (!agree) e.agree = "Please accept the Terms to continue.";
    setErr(e);
    if (!Object.keys(e).length) setOrgOpen(true);
  };

  const openSso = () => {
    if (!agree) {
      setErr({ agree: "Please accept the Terms to continue." });
      return;
    }
    setErr({});
    setSsoOpen(true);
  };

  const onSsoPick = (provider: "google" | "microsoft" | "saml") => {
    setSsoOpen(false);
    if (provider === "saml") setOrgOpen(true);
    else setSso(provider);
  };

  const completeSetup = () => {
    setOrgOpen(false);
    finishingRef.current = true;
    // New members run through workspace onboarding (invite team, roles,
    // tracking, dashboard widgets) before they land on the dashboard.
    void login(DEMO_EMAIL, "demo1234").finally(() => router.replace("/onboarding"));
  };

  const signupError = Object.values(err).filter(Boolean)[0];

  if (hydrated && isAuthenticated) return null;

  return (
    <>
      <AuthFrame maxWidth={432}>
        <AuthCard>
          <form onSubmit={submitAccount}>
            <AuthCardHeader
              title="Create your account"
              subtitle="Start a free WorkPulse workspace for your team."
            />

            <div className="space-y-2.5">
              <AuthField id="name" icon={UserRound} type="text" value={acct.name} onChange={setA("name")} placeholder="Full name" error={err.name} autoComplete="name" />
              <AuthField id="su-email" icon={Mail} type="email" value={acct.email} onChange={setA("email")} placeholder="Work email" error={err.email} autoComplete="email" />
              <AuthField
                id="su-password"
                icon={Lock}
                type={showPw ? "text" : "password"}
                value={acct.password}
                onChange={setA("password")}
                placeholder="Password"
                error={err.password}
                autoComplete="new-password"
                toggle={<PwToggle show={showPw} onClick={() => setShowPw((s) => !s)} />}
              />
              <AuthField id="confirm" icon={Lock} type={showPw ? "text" : "password"} value={acct.confirm} onChange={setA("confirm")} placeholder="Confirm password" error={err.confirm} autoComplete="new-password" />
            </div>

            {signupError ? (
              <p className="mt-2 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
                {signupError}
              </p>
            ) : null}

            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <span
                className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors"
                style={{
                  borderColor: agree
                    ? "var(--m-accent)"
                    : err.agree
                      ? "var(--m-danger)"
                      : "var(--m-border-strong)",
                  background: agree ? "var(--m-accent)" : "transparent",
                  color: "#fff",
                }}
              >
                {agree ? <Check className="size-3" /> : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  if (e.target.checked) setErr((p) => ({ ...p, agree: undefined }));
                }}
              />
              <span className="text-xs leading-relaxed" style={{ color: "var(--m-muted)" }}>
                I agree to WorkPulse&apos;s{" "}
                <a href="#" className="font-medium hover:underline" style={{ color: "var(--m-accent-ink)" }}>Terms of Service</a>{" "}
                and{" "}
                <a href="#" className="font-medium hover:underline" style={{ color: "var(--m-accent-ink)" }}>Privacy Policy</a>.
              </span>
            </label>

            <button type="submit" className="m-btn m-btn-primary mt-3.5 w-full">
              Continue <ArrowRight className="size-4" />
            </button>

            <Divider />

            <button type="button" onClick={openSso} className="m-btn m-btn-ghost w-full">
              <KeyRound className="size-[18px]" /> Continue with SSO
            </button>

            <CardSwitch prompt="Already have an account?" href="/login" label="Log in" />
          </form>
        </AuthCard>
      </AuthFrame>

      <SsoOptionsModal open={ssoOpen} onClose={() => setSsoOpen(false)} onPick={onSsoPick} />
      <SsoPickerModal
        provider={sso}
        onClose={() => setSso(null)}
        onPicked={() => {
          setSso(null);
          setOrgOpen(true);
        }}
      />
      <OrgSetupModal open={orgOpen} onClose={() => setOrgOpen(false)} onComplete={completeSetup} />
    </>
  );
}
