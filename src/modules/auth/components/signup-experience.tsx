"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Check, Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { DEMO_EMAIL } from "@/modules/auth/services/auth.service";
import { Logo } from "@/modules/marketing/logo";
import {
  OrgSetupModal,
  SsoOptionsModal,
  SsoPickerModal,
} from "@/modules/auth/components/auth-modals";

type AccountErrors = Partial<
  Record<"name" | "email" | "password" | "confirm" | "agree", string>
>;

export function SignupExperience() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [acct, setAcct] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<AccountErrors>({});
  const [showPw, setShowPw] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [sso, setSso] = useState<"google" | "microsoft" | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);

  const setA = (k: keyof typeof acct) => (v: string) =>
    setAcct((s) => ({ ...s, [k]: v }));

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
    if (provider === "saml") {
      setOrgOpen(true); // enterprise SSO → straight to workspace setup
    } else {
      setSso(provider); // open the Google/Microsoft account chooser
    }
  };

  const completeSetup = () => {
    setOrgOpen(false);
    // Demo: sign into the seeded owner workspace so the app is reachable.
    void login(DEMO_EMAIL, "demo1234").finally(() =>
      router.replace("/dashboard"),
    );
  };

  return (
    <div className="m-root min-h-screen w-full lg:grid lg:grid-cols-[1fr_1.05fr]">
      {/* ── Right: immersive brand panel (mirror of login) ── */}
      <aside
        className="relative order-none hidden overflow-hidden text-white lg:order-2 lg:flex lg:flex-col lg:justify-between lg:p-14"
        style={{
          background:
            "radial-gradient(120% 90% at 88% 8%, rgba(47,157,146,0.42), transparent 52%)," +
            "radial-gradient(110% 90% at 8% 96%, rgba(15,118,110,0.55), transparent 58%)," +
            "linear-gradient(200deg, #07100f 0%, #0a1a18 55%, #071312 100%)",
        }}
      >
        {/* Workforce illustration — fills the panel, people to the right */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/logindesign.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 52vw, 0px"
            className="object-cover object-right"
          />
          {/* left scrim so the headline stays legible over the artwork */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(6,15,14,0.88) 0%, rgba(6,15,14,0.5) 38%, rgba(6,15,14,0.05) 66%, transparent 100%)",
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
          className="m-enter-right relative z-10 max-w-md"
          style={{ animationDelay: "160ms" }}
        >
          <h2 className="m-display text-[2.6rem] font-semibold leading-[1.08] tracking-tight">
            Set your whole
            <br />
            organization in motion.
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
            Time, attendance, tasks, and productivity — one calm place for the
            whole team, from first clock-in to payroll-ready timesheets.
          </p>
        </div>

        {/* Spacer keeps the headline vertically centred in the panel */}
        <div aria-hidden />
      </aside>

      {/* ── Left: account form ── */}
      <main
        className="order-none flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:order-1"
        style={{ background: "var(--m-bg)" }}
      >
        <form
          onSubmit={submitAccount}
          className="m-enter-left w-full max-w-[400px]"
          style={{ animationDelay: "120ms" }}
        >
          <Link href="/" className="mb-9 inline-flex lg:hidden">
            <Logo />
          </Link>

          <h1 className="m-display text-2xl font-semibold">Create your account</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--m-muted)" }}>
            Start a free WorkPulse workspace for your team.
          </p>

          {/* Email signup */}
          <div className="mt-6 space-y-3">
            <Field id="name" label="Full name" type="text" value={acct.name} onChange={setA("name")} error={err.name} autoComplete="name" />
            <Field id="email" label="Work email" type="email" value={acct.email} onChange={setA("email")} error={err.email} autoComplete="email" />
            <Field
              id="password"
              label="Password"
              type={showPw ? "text" : "password"}
              value={acct.password}
              onChange={setA("password")}
              error={err.password}
              autoComplete="new-password"
              toggle={
                <button type="button" onClick={() => setShowPw((s) => !s)} className="m-field-toggle" aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />
            <Field id="confirm" label="Confirm password" type={showPw ? "text" : "password"} value={acct.confirm} onChange={setA("confirm")} error={err.confirm} autoComplete="new-password" />
          </div>

          {Object.values(err).filter(Boolean)[0] ? (
            <p className="mt-3 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
              {Object.values(err).filter(Boolean)[0]}
            </p>
          ) : null}

          {/* Terms & Conditions checkbox */}
          <label className="mt-4 flex cursor-pointer items-start gap-2.5">
            <span
              className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors"
              style={{
                borderColor: agree ? "var(--m-accent)" : err.agree ? "var(--m-danger)" : "var(--m-border-strong)",
                background: agree ? "var(--m-accent)" : "transparent",
                color: "var(--m-on-accent)",
              }}
            >
              {agree ? <Check className="size-3" /> : null}
            </span>
            <input type="checkbox" className="sr-only" checked={agree} onChange={(e) => { setAgree(e.target.checked); if (e.target.checked) setErr((p) => ({ ...p, agree: undefined })); }} />
            <span className="text-xs leading-relaxed" style={{ color: "var(--m-muted)" }}>
              I agree to WorkPulse&apos;s{" "}
              <a href="#" className="font-medium hover:underline" style={{ color: "var(--m-accent-ink)" }}>Terms of Service</a>{" "}
              and{" "}
              <a href="#" className="font-medium hover:underline" style={{ color: "var(--m-accent-ink)" }}>Privacy Policy</a>.
            </span>
          </label>

          <button type="submit" className="m-btn m-btn-primary mt-4 w-full">
            Continue <ArrowRight className="size-4" />
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
            <span className="text-xs" style={{ color: "var(--m-muted)" }}>or</span>
            <span className="h-px flex-1" style={{ background: "var(--m-border)" }} />
          </div>

          {/* SSO entry — opens the provider options */}
          <button type="button" onClick={openSso} className="m-btn m-btn-ghost w-full">
            <KeyRound className="size-[18px]" /> Continue with SSO
          </button>

          <p className="mt-5 text-center text-sm" style={{ color: "var(--m-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--m-text)" }}>
              Log in
            </Link>
          </p>
        </form>
      </main>

      {/* SSO provider options → Google/Microsoft account chooser or enterprise SSO */}
      <SsoOptionsModal open={ssoOpen} onClose={() => setSsoOpen(false)} onPick={onSsoPick} />

      {/* SSO account picker → on pick, open org setup */}
      <SsoPickerModal
        provider={sso}
        onClose={() => setSso(null)}
        onPicked={() => {
          setSso(null);
          setOrgOpen(true);
        }}
      />

      {/* Organization setup dialog */}
      <OrgSetupModal
        open={orgOpen}
        onClose={() => setOrgOpen(false)}
        onComplete={completeSetup}
      />
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
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  toggle?: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <div className={`m-field ${error ? "m-error" : ""}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        autoComplete={autoComplete}
        aria-invalid={!!error}
        style={toggle ? { paddingRight: "44px" } : undefined}
      />
      <label htmlFor={id}>{label}</label>
      {toggle}
    </div>
  );
}
