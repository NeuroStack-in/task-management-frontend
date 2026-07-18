"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError, createOrg } from "@/lib/api";
import {
  OrgSetupModal,
  SsoOptionsModal,
  SsoPickerModal,
  type OrgSignupPayload,
} from "@/modules/auth/components/auth-modals";
import {
  AuthCard,
  AuthCardHeader,
  AuthField,
  AuthFrame,
  CardSwitch,
  PwToggle,
} from "./auth-frame";

type AccountErrors = Partial<
  Record<"name" | "email" | "password" | "confirm" | "agree", string>
>;

/** Map a create-org failure to a user-facing message. The global slug is the common collision. */
function createOrgMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 409 || /slug/i.test(e.message))
      return "That workspace URL is already taken — pick another.";
    if (e.status === 400)
      return e.message || "Please check your organization details and try again.";
    return e.message || "Couldn't create your workspace. Please try again shortly.";
  }
  return "Couldn't create your workspace. Check your connection and try again.";
}

export function SignupExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
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

  useEffect(() => {
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

  // Create the org (public POST /v1/org/create), then sign the new owner straight in. Rejects with
  // a user-facing message so OrgSetupModal reverts to the plan step and shows it.
  const completeSetup = async (payload: OrgSignupPayload) => {
    const { org, region, profile, plan } = payload;
    try {
      await createOrg({
        org: {
          name: org.name.trim(),
          slug: org.slug.trim(),
          industry: org.industry || undefined,
          size: org.size || undefined,
          website: org.website.trim() || undefined,
          timezone: region.timezone || undefined,
          country: region.country || undefined,
          currency: region.currency || undefined,
        },
        owner: {
          email: acct.email.trim(),
          password: acct.password,
          full_name: profile.fullName.trim() || acct.name.trim(),
          job_title: profile.jobTitle.trim() || undefined,
          department: profile.department.trim() || undefined,
          location: profile.location.trim() || undefined,
          phone: profile.phone.trim() || undefined,
        },
        plan,
      });
    } catch (e) {
      throw new Error(createOrgMessage(e)); // surfaced by the modal
    }

    // Org + owner Cognito login exist now. Sign in; fall back to /login if that hiccups —
    // the account is real either way, so never present this as a failure.
    setOrgOpen(false);
    try {
      await login(acct.email.trim(), acct.password);
      toast.success("Workspace created", { description: "Welcome to WorkPulse." });
      router.replace("/dashboard");
    } catch {
      toast.success("Workspace created", {
        description: "Sign in with your new password to continue.",
      });
      router.replace("/login");
    }
  };

  const signupError = Object.values(err).filter(Boolean)[0];

  if (hydrated && isAuthenticated) return null;

  return (
    <>
      <AuthFrame
        headline="Set your whole organization in motion."
        copy="Time, attendance, tasks, and productivity — one calm place for the whole team, from first clock-in to payroll-ready timesheets."
        brandSide="right"
        maxWidth={440}
      >
        <AuthCard>
          <form onSubmit={submitAccount}>
            <AuthCardHeader
              title="Create your account"
              subtitle="Start a free WorkPulse workspace for your team."
            />

            <div className="space-y-4">
              <AuthField id="name" label="Full name" icon={UserRound} type="text" value={acct.name} onChange={setA("name")} error={err.name} autoComplete="name" />
              <AuthField id="su-email" label="Work email" icon={Mail} type="email" value={acct.email} onChange={setA("email")} error={err.email} autoComplete="email" />
              <AuthField
                id="su-password"
                label="Password"
                type={showPw ? "text" : "password"}
                value={acct.password}
                onChange={setA("password")}
                error={err.password}
                autoComplete="new-password"
                toggle={<PwToggle show={showPw} onClick={() => setShowPw((s) => !s)} />}
              />
              <AuthField id="confirm" label="Confirm password" icon={Lock} type={showPw ? "text" : "password"} value={acct.confirm} onChange={setA("confirm")} error={err.confirm} autoComplete="new-password" />
            </div>

            {signupError ? (
              <p className="mt-2.5 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
                {signupError}
              </p>
            ) : null}

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
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

            <button type="submit" className="m-btn m-btn-primary mt-4 w-full">
              Continue <ArrowRight className="size-4" />
            </button>

            <button
              type="button"
              onClick={openSso}
              className="m-btn m-btn-ghost mt-2.5 w-full"
            >
              <KeyRound className="size-4" /> Continue with SSO
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
