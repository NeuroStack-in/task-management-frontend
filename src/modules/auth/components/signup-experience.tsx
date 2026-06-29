"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    <div className="m-root grid min-h-screen lg:grid-cols-[0.82fr_1fr]">
      {/* ---- Brand panel ---- */}
      <aside
        className="m-enter-left relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-12"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--m-accent), #000 8%), color-mix(in srgb, var(--m-accent), #000 60%))",
          color: "#fff",
        }}
      >
        <div className="m-aurora" aria-hidden style={{ opacity: 0.5 }}>
          <span style={{ width: "60%", height: "60%", left: "-10%", top: "0%", background: "#fff", mixBlendMode: "screen", animation: "m-drift-a 26s ease-in-out infinite" }} />
          <span style={{ width: "55%", height: "55%", right: "-8%", bottom: "-6%", background: "var(--m-accent-2)", mixBlendMode: "screen", animation: "m-drift-c 30s ease-in-out infinite" }} />
        </div>

        <div className="relative">
          <Link href="/">
            <Logo className="[&_span]:text-white" />
          </Link>
        </div>

        <div className="relative">
          <div
            className="mb-8 w-60 rounded-2xl border border-white/20 bg-white/12 p-4 backdrop-blur-md"
            style={{ animation: "m-float 6s ease-in-out infinite" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/80">Team pulse</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem]">+4%</span>
            </div>
            <p className="mt-2 font-display text-3xl font-semibold">92%</p>
            <svg viewBox="0 0 220 44" className="mt-2 w-full" fill="none">
              <path d="M2 34 C 30 28, 45 12, 70 18 S 120 38, 150 20 S 200 8, 218 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="m-display max-w-xs text-3xl leading-tight font-semibold">
            Set your whole organization in motion.
          </h2>
          <ul className="mt-5 space-y-2.5 text-sm text-white/85">
            {[
              "Time tracking, attendance & timesheets",
              "Activity & productivity insights",
              "Projects, tasks & approvals in one place",
              "Enterprise SSO, audit logs & roles",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20">
                  <Check className="size-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© 2026 WorkPulse · SOC 2 · GDPR</p>
      </aside>

      {/* ---- Account form ---- */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <form onSubmit={submitAccount} className="m-enter-right w-full max-w-[440px]">
          <Link href="/" className="mb-6 inline-block lg:hidden">
            <Logo />
          </Link>

          <h1 className="m-display text-3xl font-semibold">Create your account</h1>
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
