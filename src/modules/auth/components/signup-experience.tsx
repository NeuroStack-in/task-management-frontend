"use client";

/**
 * Create a workspace — the full five-step flow, **inline in the form column**.
 *
 * It used to collect the account here and then throw a four-step modal over the page for the rest.
 * Two problems with that: the dialog covered the brand panel that tells a user what site they are
 * on, and a modal over a sign-up form reads as an interruption rather than progress. The same four
 * steps now run in place, after the account step:
 *
 *   1 Account · 2 Organization · 3 Region · 4 Your profile · 5 Plan
 *
 * ## What was deliberately dropped from the modal's version
 *
 * **The logo and avatar uploads.** `POST /v1/org/create` has no field for either, and there is no
 * presigned-upload route yet, so the modal collected two images and discarded them silently. Every
 * remaining field on these steps maps to a real property the server stores.
 *
 * The billing monthly/annual toggle is kept but only changes the *displayed* price — the server
 * takes `plan` alone, with no cadence — so it never implies a saved choice.
 *
 * The password rules mirror the **Cognito pool policy**, not this app's preference. The backend's
 * own validator is laxer (≥8), so matching only the backend would let someone through to a Cognito
 * rejection they could not act on.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
// `createOrg` and `slugify` live in `lib/api` on this branch, not in a per-module service — the
// signup contract is kept beside the other public identity calls (`lookupInvite`, `acceptInvite`).
import { ApiError, createOrg, slugify } from "@/lib/api";
import {
  COUNTRIES,
  COUNTRY_CURRENCY,
  CURRENCIES,
  INDUSTRIES,
  MSelect,
  PLANS,
  SIZES,
  TIMEZONES,
} from "@/modules/auth/components/auth-modals";
import { SsoProviderButtons } from "./sso-provider-buttons";
import { PlanDetailsDialog } from "./plan-details-dialog";
import {
  AuthErrorSummary,
  AuthField,
  AuthFrame,
  AuthHeading,
  AuthPasswordField,
  AuthPasswordRules,
  AuthSteps,
  AuthSwitch,
  passwordMeetsPolicy,
} from "./auth-frame";

type Errors = Record<string, string | undefined>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ["Account", "Organization", "Region", "Your profile", "Plan"];
const LAST = STEP_LABELS.length - 1;

/** `CURRENCIES` are display strings like `"USD — US Dollar"`; the server wants the code. */
const codeOf = (s: string) => s.split("—")[0]?.trim() || undefined;

export function SignupExperience() {
  const router = useRouter();
  const params = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  /** Used to sign the new owner in immediately after the org is created. */
  const login = useAuthStore((s) => s.login);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [acct, setAcct] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [org, setOrg] = useState({ name: "", slug: "", industry: "", size: "", website: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [region, setRegion] = useState({ country: "", currency: "", timezone: "" });
  const [profile, setProfile] = useState({
    fullName: "",
    jobTitle: "",
    department: "",
    location: "",
    phone: "",
  });
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [plan, setPlan] = useState("free");
  const [consent, setConsent] = useState(false);
  const [planInfoOpen, setPlanInfoOpen] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
    }
  }, [hydrated, isAuthenticated, params, router]);

  /* ---------------- validation, per step ---------------- */

  const validateStep = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (acct.name.trim().length < 2) e["signup-name"] = "Enter your full name";
      if (!acct.email.trim()) e["signup-email"] = "Enter your work email";
      else if (!EMAIL_RE.test(acct.email.trim()))
        e["signup-email"] = "Enter an email address in the correct format, like name@company.com";
      if (!passwordMeetsPolicy(acct.password))
        e["signup-password"] = "Your password doesn't meet all the requirements yet";
      if (acct.confirm !== acct.password) e["signup-confirm"] = "Both passwords must match";
      if (!agree) e["signup-agree"] = "Accept the Terms of Service to continue";
    }
    if (s === 1) {
      if (!org.name.trim()) e["org-name"] = "Enter your organization's name";
      if (!slugify(org.slug || org.name)) e["org-slug"] = "Enter a valid workspace address";
      if (!org.industry) e["org-industry"] = "Choose your industry";
      if (!org.size) e["org-size"] = "Choose your organization size";
    }
    if (s === 2) {
      if (!region.country) e["org-country"] = "Choose your headquarters country";
      if (!region.currency) e["org-currency"] = "Choose your billing currency";
    }
    if (s === 3) {
      if (!profile.jobTitle.trim()) e["me-title"] = "Enter your job title";
    }
    if (s === 4) {
      if (!plan) e["org-plan"] = "Choose a plan";
      if (!consent) e["org-consent"] = "Confirm the monitoring authorization to continue";
    }
    return e;
  };

  const clear = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const goNext = () => {
    setSubmitted(true);
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSubmitted(false);
    setErrors({});
    // The owner's display name is already known from step 1 — carry it forward rather than
    // asking the same question twice.
    if (step === 2 && !profile.fullName) {
      setProfile((p) => ({ ...p, fullName: acct.name.trim() }));
    }
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setSubmitted(false);
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  /* ---------------- commit ---------------- */

  const submit = async () => {
    setSubmitted(true);
    const found = validateStep(LAST);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const created = await createOrg({
        org: {
          name: org.name.trim(),
          slug: slugify(org.slug || org.name),
          industry: org.industry || undefined,
          size: org.size || undefined,
          website: org.website.trim() || undefined,
          country: region.country || undefined,
          currency: codeOf(region.currency),
          timezone:
            region.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        },
        owner: {
          email: acct.email.trim().toLowerCase(),
          password: acct.password,
          full_name: (profile.fullName || acct.name).trim(),
          job_title: profile.jobTitle.trim() || undefined,
          department: profile.department.trim() || undefined,
          location: profile.location.trim() || undefined,
          phone: profile.phone.trim() || undefined,
        },
        plan,
      });
      // The org and the owner's Cognito login both exist now, so sign them straight in rather than
      // bouncing to /login to ask for a password they set thirty seconds ago.
      //
      // A failure here is NOT a signup failure — the account is real either way — so it never
      // surfaces as an error. It falls back to the sign-in page with the email prefilled.
      try {
        await login(acct.email.trim().toLowerCase(), acct.password);
        toast.success("Workspace created", {
          description: `${created.slug} is ready — let's finish setting things up.`,
        });
        router.replace("/onboarding");
      } catch {
        toast.success("Workspace created", {
          description: "Sign in with your new password to continue.",
        });
        router.replace(`/login?email=${encodeURIComponent(acct.email.trim().toLowerCase())}`);
      }
    } catch (e) {
      setSubmitting(false);
      const msg =
        e instanceof ApiError && e.status === 409
          ? "That workspace address is already taken — go back and try another."
          : e instanceof ApiError
            ? e.message
            : "Couldn't create your workspace. Try again.";
      setErrors({ "org-plan": msg });
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  if (hydrated && isAuthenticated) return null;

  const summary = Object.entries(errors).filter(([, v]) => Boolean(v)) as [string, string][];
  const previewSlug = slugify(org.slug || org.name);

  const HEADINGS: [string, string][] = [
    ["Create your workspace", "You'll be the owner — you can invite your team next."],
    ["About your organization", "This names your workspace and its web address."],
    ["Region & localization", "How WorkPulse formats time and currency for your teams."],
    ["Your profile", "How your team sees you. Everything here is editable later."],
    ["Choose a plan", "Free while in beta — no card required."],
  ];

  return (
    <>
      <AuthFrame
        headline="Set your organization"
        headlineAccent="in motion today"
        copy="Free while in beta, no card required. Create your workspace, invite your team, and have time and attendance running the same afternoon."
      >
        <AuthHeading title={HEADINGS[step][0]} subtitle={HEADINGS[step][1]} />
        <AuthSteps steps={STEP_LABELS} current={step} />

        {submitted ? <AuthErrorSummary errors={summary} summaryRef={summaryRef} /> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === LAST) void submit();
            else goNext();
          }}
          noValidate
        >
          {/* ---------------- 1 · Account ---------------- */}
          {step === 0 ? (
            <>
              <div className="m-arow m-arow--first">
                <AuthField
                  id="signup-name"
                  label="Full name"
                  value={acct.name}
                  onChange={(v) => {
                    setAcct((s) => ({ ...s, name: v }));
                    clear("signup-name");
                  }}
                  error={errors["signup-name"]}
                  autoComplete="name"
                />
                <AuthField
                  id="signup-email"
                  label="Work email"
                  type="email"
                  value={acct.email}
                  onChange={(v) => {
                    setAcct((s) => ({ ...s, email: v }));
                    clear("signup-email");
                  }}
                  error={errors["signup-email"]}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="m-arow">
                <AuthPasswordField
                  id="signup-password"
                  label="Password"
                  value={acct.password}
                  onChange={(v) => {
                    setAcct((s) => ({ ...s, password: v }));
                    clear("signup-password");
                  }}
                  error={errors["signup-password"]}
                  autoComplete="new-password"
                />
                <AuthPasswordField
                  id="signup-confirm"
                  label="Confirm password"
                  value={acct.confirm}
                  onChange={(v) => {
                    setAcct((s) => ({ ...s, confirm: v }));
                    clear("signup-confirm");
                  }}
                  error={errors["signup-confirm"]}
                  autoComplete="new-password"
                />
              </div>

              <AuthPasswordRules value={acct.password} confirm={acct.confirm} showMatch />

              <label className="m-check mt-3">
                <input
                  type="checkbox"
                  id="signup-agree"
                  name="signup-agree"
                  checked={agree}
                  onChange={(e) => {
                    setAgree(e.target.checked);
                    clear("signup-agree");
                  }}
                  {...(errors["signup-agree"] ? { "aria-invalid": true as const } : {})}
                />
                <span className="m-check__text">
                  I agree to the Terms of Service and Privacy Policy.
                </span>
              </label>
            </>
          ) : null}

          {/* ---------------- 2 · Organization ---------------- */}
          {step === 1 ? (
            <>
              <AuthField
                id="org-name"
                label="Organization name"
                value={org.name}
                onChange={(v) => {
                  setOrg((s) => ({ ...s, name: v, slug: slugTouched ? s.slug : slugify(v) }));
                  clear("org-name");
                }}
                error={errors["org-name"]}
                autoComplete="organization"
              />
              <AuthField
                id="org-slug"
                label="Workspace address"
                value={org.slug}
                onChange={(v) => {
                  setSlugTouched(true);
                  setOrg((s) => ({ ...s, slug: slugify(v) }));
                  clear("org-slug");
                }}
                error={errors["org-slug"]}
                hint={previewSlug ? `${previewSlug}.workpulse.io` : "Letters, numbers and dashes."}
              />
              <div className="m-arow">
                <div className="m-afield">
                  <span className="m-acap">Industry</span>
                  <MSelect
                    value={org.industry}
                    onChange={(v) => {
                      setOrg((s) => ({ ...s, industry: v }));
                      clear("org-industry");
                    }}
                    options={INDUSTRIES}
                    ariaLabel="Industry"
                  />
                </div>
                <div className="m-afield">
                  <span className="m-acap">Organization size</span>
                  <MSelect
                    value={org.size}
                    onChange={(v) => {
                      setOrg((s) => ({ ...s, size: v }));
                      clear("org-size");
                    }}
                    options={SIZES}
                    ariaLabel="Organization size"
                  />
                </div>
              </div>
              <AuthField
                id="org-website"
                label="Website"
                value={org.website}
                onChange={(v) => setOrg((s) => ({ ...s, website: v }))}
                hint="Optional"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
            </>
          ) : null}

          {/* ---------------- 3 · Region ---------------- */}
          {step === 2 ? (
            <>
              <div className="m-afield">
                <span className="m-acap">Headquarters country</span>
                <MSelect
                  value={region.country}
                  onChange={(v) => {
                    // Picking a country pre-fills the matching billing currency.
                    setRegion((s) => ({
                      ...s,
                      country: v,
                      currency: COUNTRY_CURRENCY[v] ?? s.currency,
                    }));
                    clear("org-country");
                    clear("org-currency");
                  }}
                  options={COUNTRIES}
                  ariaLabel="Headquarters country"
                />
              </div>
              <div className="m-arow">
                <div className="m-afield">
                  <span className="m-acap">Default timezone</span>
                  <MSelect
                    value={region.timezone}
                    onChange={(v) => setRegion((s) => ({ ...s, timezone: v }))}
                    options={TIMEZONES}
                    ariaLabel="Default timezone"
                  />
                </div>
                <div className="m-afield">
                  <span className="m-acap">Billing currency</span>
                  <MSelect
                    value={region.currency}
                    onChange={(v) => {
                      setRegion((s) => ({ ...s, currency: v }));
                      clear("org-currency");
                    }}
                    options={CURRENCIES}
                    ariaLabel="Billing currency"
                  />
                </div>
              </div>
              <p className="m-anote">
                Timezone defaults to this browser&apos;s if you leave it blank.
              </p>
            </>
          ) : null}

          {/* ---------------- 4 · Your profile ---------------- */}
          {step === 3 ? (
            <>
              <div className="m-arow m-arow--first">
                <AuthField
                  id="me-name"
                  label="Full name"
                  value={profile.fullName}
                  onChange={(v) => setProfile((s) => ({ ...s, fullName: v }))}
                  autoComplete="name"
                />
                <AuthField
                  id="me-title"
                  label="Job title"
                  value={profile.jobTitle}
                  onChange={(v) => {
                    setProfile((s) => ({ ...s, jobTitle: v }));
                    clear("me-title");
                  }}
                  error={errors["me-title"]}
                  autoComplete="organization-title"
                />
              </div>
              <div className="m-arow">
                <AuthField
                  id="me-dept"
                  label="Department"
                  value={profile.department}
                  onChange={(v) => setProfile((s) => ({ ...s, department: v }))}
                  hint="Optional"
                />
                <AuthField
                  id="me-location"
                  label="Work location"
                  value={profile.location}
                  onChange={(v) => setProfile((s) => ({ ...s, location: v }))}
                  hint="Optional"
                />
              </div>
              <AuthField
                id="me-phone"
                label="Work phone"
                type="tel"
                value={profile.phone}
                onChange={(v) => setProfile((s) => ({ ...s, phone: v }))}
                hint="Optional"
                autoComplete="tel"
                inputMode="tel"
              />
            </>
          ) : null}

          {/* ---------------- 5 · Plan ---------------- */}
          {step === 4 ? (
            <>
              <div className="m-planbar">
                <div className="m-billtoggle" role="group" aria-label="Billing period">
                  <button type="button" data-on={billing === "monthly"} onClick={() => setBilling("monthly")}>
                    Monthly
                  </button>
                  <button type="button" data-on={billing === "annual"} onClick={() => setBilling("annual")}>
                    Annual <span>−17%</span>
                  </button>
                </div>
                {/* The rows below carry a one-line pitch each; the full feature lists don't fit the
                    column, so they live in the dialog rather than being cut from the product. */}
                <button
                  type="button"
                  className="m-infobtn"
                  onClick={() => setPlanInfoOpen(true)}
                  aria-label="Compare plans in detail"
                >
                  <Info aria-hidden="true" />
                </button>
              </div>

              <fieldset className="m-planlist">
                <legend className="m-sr">Plan</legend>
                {PLANS.map((pl) => {
                  const price = billing === "annual" ? pl.annual : pl.monthly;
                  return (
                    <label key={pl.id} className={plan === pl.id ? "is-on" : undefined}>
                      <input
                        type="radio"
                        name="plan"
                        value={pl.id}
                        checked={plan === pl.id}
                        onChange={() => {
                          setPlan(pl.id);
                          clear("org-plan");
                        }}
                      />
                      <span className="m-planlist__body">
                        <strong>
                          {pl.name}
                          {pl.featured ? <i>Popular</i> : null}
                        </strong>
                        <em>{pl.tagline}</em>
                      </span>
                      <span className="m-planlist__price">
                        {price === 0 ? "Free" : `$${price}`}
                        {price === 0 ? null : <i>/user/mo</i>}
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <label className="m-check mt-2">
                <input
                  type="checkbox"
                  id="org-consent"
                  name="org-consent"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    clear("org-consent");
                  }}
                  {...(errors["org-consent"] ? { "aria-invalid": true as const } : {})}
                />
                <span className="m-check__text">
                  I&apos;m authorized to enable workforce monitoring for this organization.
                  <span className="m-check__note">
                    You&apos;re responsible for telling your team what is tracked.
                  </span>
                </span>
              </label>
            </>
          ) : null}

          <div className="m-authactions">
            {step > 0 ? (
              <button type="button" onClick={goBack} className="m-btn m-btn-ghost" disabled={submitting}>
                <ArrowLeft className="size-4" /> Back
              </button>
            ) : null}
            <button type="submit" className="m-btn m-btn-primary flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="m-spin size-4" /> Creating…
                </>
              ) : step === LAST ? (
                "Create workspace"
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </form>

        {/* SSO below the primary action, and only on the first step — once the flow has started,
            switching identity method would discard everything entered so far. */}
        {step === 0 ? (
          <>
            <div className="m-authdiv">or</div>
            {/* Inline SSO (no modal). On signup these route to sign-IN via the IdP — social is
                invited-users-only and enterprise SSO joins an existing org, so neither creates a
                workspace here; the backend accepts or rejects. */}
            <SsoProviderButtons
              email={acct.email}
              onError={(m) => setErrors(m ? { "signup-email": m } : {})}
            />
            <AuthSwitch prompt="Already have an account?" href="/login" label="Sign in" />
          </>
        ) : null}
      </AuthFrame>

      <PlanDetailsDialog
        open={planInfoOpen}
        onClose={() => setPlanInfoOpen(false)}
        billing={billing}
        selected={plan}
        onSelect={(id) => {
          setPlan(id);
          clear("org-plan");
        }}
      />
    </>
  );
}
