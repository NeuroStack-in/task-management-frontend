"use client";

/**
 * Request a workspace — the full five-step flow, **inline in the form column**.
 *
 * **Every sign-up is a request** (owner decision 2026-10-17, UX audit ONB-01). The email path used to
 * create the organization outright through the public `POST /v1/org/create` — on any plan — while a
 * Google sign-up waited for staff approval. Now the email path creates the login, confirms it with
 * the emailed code ({@link ConfirmEmailStep}), signs in and submits the same `POST /v1/org/requests`;
 * the waiting screen at `/onboarding` takes it from there. No workspace ID, prefix or plan is asked
 * for: approval assigns the first two and starts every org on Free.
 *
 * It used to collect the account here and then throw a four-step modal over the page for the rest.
 * Two problems with that: the dialog covered the brand panel that tells a user what site they are
 * on, and a modal over a sign-up form reads as an interruption rather than progress. The steps now
 * run in place:
 *
 *   1 Account · 2 Organization · 3 Plan
 *
 * ## Three steps, not five (UX audit 2026-10-16, ONB-04)
 *
 * It was five steps and about twenty fields before anyone saw the product. Two steps went:
 *
 *  - **Region** is folded into Organization and starts from the browser (`signup-region.ts`) — the
 *    applicant corrects it rather than picks it.
 *  - **Your profile** (job title, department, location, phone, date of birth, work mode) is gone
 *    from sign-up. None of it is needed to review or build an organization — `POST /v1/org/requests`
 *    requires only `org_name` — and it is personal data asked for before the workspace even exists.
 *    The first-run profile gate (`modules/onboarding/components/first-run-gate.tsx`) asks for
 *    contact number, location and work mode at the owner's first sign-in, with date of birth
 *    optional, and the owner's job title is theirs to set on their own employee record.
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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { ApiError } from "@/lib/api";
import { requestOrg } from "@/modules/onboarding/services/onboarding.service";
import {
  AuthError,
  EmailTakenError,
  confirmEmailSignUp,
  resendSignUpCode,
  signUpWithEmail,
} from "@/modules/auth/services/auth.service";
import { ConfirmEmailStep } from "./confirm-email-step";
import {
  COUNTRY_CURRENCY,
  CURRENCIES,
  INDUSTRIES,
  MSelect,
  SIZES,
  TIMEZONES,
} from "@/modules/auth/components/auth-modals";
import { browserRegion } from "./signup-region";
import { SsoProviderButtons } from "./sso-provider-buttons";
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
import { COUNTRIES as COUNTRY_CODES } from "@/lib/countries";
import { currentRoleSnapshot } from "@/hooks/use-permissions";
import { safeLandingPath } from "@/lib/rbac";
import { handOffEmail } from "@/modules/auth/email-handoff";
import { legalHref } from "@/modules/legal/documents";
import { membersLabel, tierOf } from "@/modules/billing/lib/plans";
import { SIGNUP_PANEL } from "@/modules/auth/signup-panel";

type Errors = Record<string, string | undefined>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ["Account", "Organization", "Plan"];
const LAST = STEP_LABELS.length - 1;

/**
 * Every country, not the old ten plus "Other": the default now comes from the browser, and a
 * default the list can't show would be dropped. Searchable, since it is long.
 */
const COUNTRY_NAMES = COUNTRY_CODES.map((c) => c.name);

/** `CURRENCIES` are display strings like `"USD — US Dollar"`; the server wants the code. */
const codeOf = (s: string) => s.split("—")[0]?.trim() || undefined;

/**
 * The picked country's ISO code — what the org-request contract documents — not its display name.
 * "Other" has none and is sent as nothing (QA audit 2026-10-08, WP-392).
 */
const isoOf = (name: string) => COUNTRY_CODES.find((c) => c.name === name)?.iso;

/**
 * @param authenticated Render for a caller who has **already signed in** and has no organization —
 *   the "Continue with Google" returnee. Step 1 (Account) is skipped, because Google has already
 *   established who they are and there is no password to set; the remaining steps run unchanged,
 *   and the flow ends by submitting an org **request** for staff approval rather than creating an
 *   organization outright.
 * @param onSubmitted Called once the request lands, so the host can swap in the waiting screen.
 */
export function SignupExperience({
  authenticated = false,
  onSubmitted,
  footer,
}: {
  authenticated?: boolean;
  onSubmitted?: () => void;
  /**
   * Rendered at the foot of the card — the signed-in host puts "Signed in as … · Sign out" here, so
   * leaving the account sits inside the card rather than loose below the page (UX audit ONB-13).
   */
  footer?: ReactNode;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  /** Used to sign the new owner in immediately after the org is created. */
  const login = useAuthStore((s) => s.login);

  /**
   * The first step this flow shows. Account is index 0, so the signed-in variant starts at 1.
   *
   * Everything else derives from this rather than hard-coding `0`: the Back button's floor, the
   * progress indicator, and whether the social buttons are offered. A stray `0` left behind would
   * let a Google returnee walk back into an account form asking them to choose a password.
   */
  const FIRST = authenticated ? 1 : 0;

  const [step, setStep] = useState(FIRST);
  const [submitting, setSubmitting] = useState(false);

  const [acct, setAcct] = useState({ name: "", email: "", password: "", confirm: "" });
  const [org, setOrg] = useState({
    name: "",
    industry: "",
    size: "",
    website: "",
  });
  const [region, setRegion] = useState({ country: "", currency: "", timezone: "" });
  /** The region pickers are folded behind a one-line summary until someone wants to change them. */
  const [regionOpen, setRegionOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  /** The Terms of Service + Privacy Policy agreement, on the last step. See the note there. */
  const [termsAccepted, setTermsAccepted] = useState(false);
  /** The email path's last stage: the login exists, waiting for the emailed code (ONB-01). */
  const [confirming, setConfirming] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In the signed-in variant this redirect is exactly backwards: being authenticated is the
    // precondition, not a reason to leave. It still guards the public flow, where an already
    // signed-in visitor has no business filling in a signup form.
    if (authenticated) return;
    if (hydrated && isAuthenticated) {
      router.replace(safeLandingPath(currentRoleSnapshot(), params.get("from")));
    }
  }, [authenticated, hydrated, isAuthenticated, params, router]);

  // Seed the account details Google already established. They are never shown as a form — step 1
  // is skipped — but the later steps read them: `profile.fullName` falls back to the account name,
  // and the request is attributed to this email.
  useEffect(() => {
    if (!authenticated || !user) return;
    setAcct((a) => ({
      ...a,
      name: a.name || user.name || "",
      email: a.email || user.email || "",
    }));
  }, [authenticated, user]);

  // Region starts from the browser (ONB-04). In an effect, not the initial state: the server render
  // has no browser to ask, and a different first paint on the client is a hydration mismatch. Only
  // empty fields are filled, so nothing the applicant already chose is overwritten.
  useEffect(() => {
    const d = browserRegion();
    setRegion((r) => ({
      country: r.country || d.country,
      currency: r.currency || d.currency,
      timezone: r.timezone || d.timezone,
    }));
  }, []);

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
    }
    if (s === 1) {
      if (!org.name.trim()) e["org-name"] = "Enter your organization's name";
      // No workspace ID or employee-ID prefix: every sign-up is a request, and approval assigns both.
      // Industry and size stay required: they are two quick picks, and they are what the person
      // reviewing the request sees beside the name (`OpsRequestRow`). Region is optional — the
      // server needs none of it, and it already starts from the browser.
      if (!org.industry) e["org-industry"] = "Choose your industry";
      if (!org.size) e["org-size"] = "Choose your organization size";
    }
    if (s === 2) {
      if (!consent) e["org-consent"] = "Confirm the monitoring authorization to continue";
      if (!termsAccepted)
        e["signup-terms"] = "Agree to the Terms of Service and Privacy Policy to continue";
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
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setSubmitted(false);
    setErrors({});
    setStep((s) => Math.max(FIRST, s - 1));
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

    // Every sign-up ends in a request that WorkPulse staff approve (ONB-01) — the Google returnee
    // here, the email path once its login is confirmed (`finishEmailSignup`).
    if (authenticated) {
      try {
        await requestOrg(requestBody());
        onSubmitted?.();
      } catch (e) {
        setSubmitting(false);
        // In the summary, focused and kept, rather than a toast that vanished (UX audit ONB-10).
        setErrors({
          "": e instanceof ApiError ? e.message : "Couldn't submit your request. Please try again.",
        });
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
      return;
    }

    // Email path: create the login; Cognito emails a code, and the confirm step takes over.
    try {
      await signUpWithEmail(acct.email.trim().toLowerCase(), acct.password);
      setSubmitting(false);
      setConfirming(true);
    } catch (e) {
      setSubmitting(false);
      if (e instanceof EmailTakenError) {
        setErrors({ "signup-email": e.message });
        setStep(0);
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      // In the summary, focused and kept, rather than a toast that vanished (UX audit ONB-10).
      setErrors({
        "": e instanceof AuthError ? e.message : "Couldn't create your account. Please try again.",
      });
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  /**
   * The request itself, identical for both paths. Every field the wizard collected is carried
   * through — `POST /v1/org/requests` stores them and replays them into the org at approval — so the
   * applicant fills this in once. No `slug`/`emp_id_prefix`/plan: the request has no field for them;
   * approval derives the first two and starts every org on Free (QA audit 2026-10-08, WP-128).
   *
   * No personal profile fields (ONB-04): the request takes them as optional, and they are left out
   * rather than filled with anything — the first-run gate asks the owner after sign-in.
   */
  const requestBody = () => ({
    org_name: org.name.trim(),
    owner_name: acct.name.trim() || undefined,
    industry: org.industry || undefined,
    size: org.size || undefined,
    website: org.website.trim() || undefined,
    country: isoOf(region.country),
    currency: codeOf(region.currency),
    timezone: region.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
    // The authorisation tick was required and then sent nowhere (QA audit 2026-10-08, WP-128).
    monitoring_consent: consent,
    terms_accepted: termsAccepted,
  });

  /**
   * The email path after the code: confirm, sign in, submit the request, and hand over to the
   * waiting screen. Safe to retry — an already-confirmed login confirms again as a no-op.
   */
  const finishEmailSignup = async (code: string) => {
    const email = acct.email.trim().toLowerCase();
    await confirmEmailSignUp(email, code);
    try {
      await login(email, acct.password);
    } catch {
      // The login exists and is confirmed; only the automatic sign-in failed. Signing in by hand
      // lands on /onboarding, which asks for the workspace again.
      toast.success("Email confirmed", { description: "Sign in to send your request." });
      handOffEmail(email);
      router.replace("/login");
      return;
    }
    try {
      await requestOrg(requestBody());
    } catch (e) {
      // Already sent (a retry after a slow first attempt) is success; anything else is shown and the
      // waiting screen offers the form again.
      if (!(e instanceof ApiError && e.code === "request_already_open")) {
        toast.error(e instanceof ApiError ? e.message : "Couldn't send your request. Please try again.");
      }
    }
    router.replace("/onboarding");
  };

  // The signed-in variant is FOR an authenticated caller, so it must not blank itself the way the
  // public form does while its redirect lands. The effect above was exempted for it and this guard
  // was not, so every "Continue with Google" user with no organization — and every rejected
  // applicant pressing "Submit a new request" — got a page with a logo and nothing else
  // (QA audit 2026-10-08, WP-029).
  if (hydrated && isAuthenticated && !authenticated) return null;

  const summary = Object.entries(errors).filter(([, v]) => Boolean(v)) as [string, string][];

  const HEADINGS: [string, string][] = [
    // The review time is said here too: below 64rem the brand panel that carries it is hidden.
    ["Request your organization", "A member of the WorkPulse team reviews each request, usually within one business day."],
    ["About your organization", "This names your organization and helps us review your request."],
    ["Your plan", "How plans work for a new organization."],
  ];

  /** The region summary's one line — what the folded pickers currently hold. */
  const regionSummary =
    [region.country, codeOf(region.currency), region.timezone].filter(Boolean).join(" · ") ||
    "Not set";
  /** The browser's zone is offered first when the fixed list doesn't carry it. */
  const timezoneOptions =
    region.timezone && !TIMEZONES.includes(region.timezone)
      ? [region.timezone, ...TIMEZONES]
      : TIMEZONES;

  if (confirming) {
    return (
      <ConfirmEmailStep
        email={acct.email.trim().toLowerCase()}
        onConfirm={finishEmailSignup}
        onResend={() => resendSignUpCode(acct.email.trim().toLowerCase())}
      />
    );
  }

  return (
    <>
      <AuthFrame {...SIGNUP_PANEL}>
        <AuthHeading title={HEADINGS[step][0]} subtitle={HEADINGS[step][1]} />
        {/* Drop the skipped step from the indicator entirely rather than showing it greyed: a
            "Step 2 of 5" that can never reach step 1 reads as something the user failed to do. */}
        <AuthSteps steps={STEP_LABELS.slice(FIRST)} current={step - FIRST} />

        {submitted ? <AuthErrorSummary errors={summary} summaryRef={summaryRef} /> : null}

        <form
          method="post"
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

              {/* The "I agree to the Terms of Service and Privacy Policy" box used to sit here. It was
                  required but linked to nothing, so people agreed to text nobody could read (QA audit
                  2026-10-08, WP-115). It is back, linked to the drafts at /legal/*, on the LAST step
                  beside the monitoring authorization rather than here. There it also covers the Google
                  returnee, who skips this step, and it sits next to the button that actually creates
                  the account or request. */}
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
                  setOrg((s) => ({ ...s, name: v }));
                  clear("org-name");
                }}
                error={errors["org-name"]}
                autoComplete="organization"
              />
              <div className="m-arow">
                <div className="m-afield">
                  <span className="m-acap">Industry</span>
                  {/* Ids, so the error summary's links land on the control (WP-389). */}
                  <MSelect
                    id="org-industry"
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
                    id="org-size"
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

              {/* Region, from the browser (ONB-04). It was a step of its own; it is now one line
                  to confirm, opening into the three pickers on "Change". All optional — the
                  request needs none of them. */}
              <div className="m-afield">
                <span className="m-acap" id="org-region-label">
                  Region
                </span>
                {regionOpen ? (
                  <div id="org-region-fields">
                    <div className="m-afield">
                      <span className="m-acap">Headquarters country</span>
                      <MSelect
                        id="org-country"
                        value={region.country}
                        onChange={(v) =>
                          // Picking a country pre-fills the matching billing currency.
                          setRegion((s) => ({
                            ...s,
                            country: v,
                            currency: COUNTRY_CURRENCY[v] ?? s.currency,
                          }))
                        }
                        options={COUNTRY_NAMES}
                        ariaLabel="Headquarters country"
                      />
                    </div>
                    <div className="m-arow">
                      <div className="m-afield">
                        <span className="m-acap">Default timezone</span>
                        <MSelect
                          id="org-timezone"
                          value={region.timezone}
                          onChange={(v) => setRegion((s) => ({ ...s, timezone: v }))}
                          options={timezoneOptions}
                          ariaLabel="Default timezone"
                        />
                      </div>
                      <div className="m-afield">
                        <span className="m-acap">Billing currency</span>
                        <MSelect
                          id="org-currency"
                          value={region.currency}
                          onChange={(v) => setRegion((s) => ({ ...s, currency: v }))}
                          options={CURRENCIES}
                          ariaLabel="Billing currency"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-sm" style={{ color: "var(--m-text)" }}>
                      {regionSummary}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRegionOpen(true);
                        // The button goes away with the summary; focus follows to the first picker.
                        requestAnimationFrame(() => document.getElementById("org-country")?.focus());
                      }}
                      aria-expanded={false}
                      aria-label="Change region"
                      className="shrink-0 text-sm font-semibold underline underline-offset-2"
                      style={{ color: "var(--m-accent-ink)" }}
                    >
                      Change
                    </button>
                  </div>
                )}
                <p className="m-anote">
                  {!regionOpen && region.country
                    ? "Taken from this browser. It sets how times and currency are shown across your organization."
                    : "Optional. It sets how times and currency are shown across your organization."}
                </p>
              </div>
            </>
          ) : null}

          {/* ---------------- 3 · Plan ---------------- */}
          {step === 2 ? (
            <>
              {/* Every sign-up is a request, and approval starts every org on Free — so this states it
                  instead of offering a choice it would drop (WP-128, ONB-01). It leads with the
                  beta and says what applies later, worded like Settings → Billing (UX audit
                  ONB-15): prices are what a paid plan would cost once billing starts, never a
                  charge now. "Settings → Billing" stays plain text: an applicant has no workspace
                  yet, so there is no page to link to (SET-15). */}
              <div className="m-planinfo">
                <p className="m-planinfo__lead">Free during the beta — nothing is charged, no card needed</p>
                <ul>
                  <li>
                    Your organization starts on the <strong>Free plan</strong> —{" "}
                    {membersLabel("free").toLowerCase()}, and it has no price.
                  </li>
                  <li>
                    <strong>Starter</strong> and <strong>Enterprise</strong> add members and
                    features. They&apos;re free during the beta too; their prices (from $
                    {tierOf("starter").pricePerSeat} per member a month) apply only once billing
                    starts.
                  </li>
                  <li>
                    Once your organization is approved, you choose the plan in Settings → Billing,
                    which also shows what it would cost once billing starts.
                  </li>
                </ul>
                <Link
                  href="/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2"
                  style={{ color: "var(--m-accent-ink)" }}
                >
                  Compare plans
                </Link>{" "}
                <span className="m-planinfo__note">(opens in a new tab)</span>
              </div>

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

              {/* Required in both variants (WP-115). The links sit inside the label: clicking one
                  opens the document and does not toggle the box, because a label ignores clicks on
                  interactive content. They open in a new tab, because leaving this page would lose
                  every step entered so far. The box's accessible name is the whole sentence, note
                  included. The acceptance is not sent to the server yet: `POST /v1/org/requests` has
                  no field for it. */}
              <label className="m-check">
                <input
                  type="checkbox"
                  id="signup-terms"
                  name="signup-terms"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    clear("signup-terms");
                  }}
                  {...(errors["signup-terms"] ? { "aria-invalid": true as const } : {})}
                />
                <span className="m-check__text">
                  I agree to the{" "}
                  <Link
                    href={legalHref("terms")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2"
                    style={{ color: "var(--m-accent-ink)" }}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href={legalHref("privacy")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2"
                    style={{ color: "var(--m-accent-ink)" }}
                  >
                    Privacy Policy
                  </Link>
                  .
                  <span className="m-check__note">Both open in a new tab.</span>
                </span>
              </label>
            </>
          ) : null}

          <div className="m-authactions">
            {step > FIRST ? (
              <button type="button" onClick={goBack} className="m-btn m-btn-ghost" disabled={submitting}>
                <ArrowLeft className="size-4" /> Back
              </button>
            ) : null}
            <button type="submit" className="m-btn m-btn-primary flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="m-spin size-4" />{" "}
                  {authenticated ? "Sending your request…" : "Creating your account…"}
                </>
              ) : step === LAST ? (
                "Submit request"
              ) : (
                "Continue"
              )}
            </button>
          </div>
        </form>

        {/* SSO below the primary action, and only on the first step — once the flow has started,
            switching identity method would discard everything entered so far. */}
        {step === 0 && !authenticated ? (
          <>
            <div className="m-authdiv">or</div>
            {/* Inline social sign-in (no modal). This doesn't run the form above: a known address
                signs in to its account, and an address WorkPulse doesn't know gets an account with
                no organization, which then asks for a workspace from /onboarding. The id is the
                target of the `signup-sso` error link. */}
            <div id="signup-sso" tabIndex={-1}>
              <SsoProviderButtons
                onError={(m) => {
                  // Its own key, not the email field's, and visible at once — it was attached,
                  // screen-reader-only, to an email field it had nothing to do with (WP-107).
                  setErrors(m ? { "signup-sso": m } : {});
                  if (m) setSubmitted(true);
                }}
              />
            </div>
            <AuthSwitch prompt="Already have an account?" href="/login" label="Sign in" />
          </>
        ) : null}
        {footer}
      </AuthFrame>

    </>
  );
}
