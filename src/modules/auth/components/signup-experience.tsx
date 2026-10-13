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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
// `createOrg` and `slugify` live in `lib/api` on this branch, not in a per-module service — the
// signup contract is kept beside the other public identity calls (`lookupInvite`, `acceptInvite`).
import {
  ApiError,
  createOrg,
  EMP_PREFIX_MAX,
  empPrefixCandidates,
  normalizeEmpPrefix,
  slugify,
} from "@/lib/api";
import { requestOrg } from "@/modules/onboarding/services/onboarding.service";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePicker } from "@/components/ui/date-picker";
import { todayIso } from "@/lib/format";
import { COUNTRIES as COUNTRY_CODES } from "@/lib/countries";
import { currentRoleSnapshot } from "@/hooks/use-permissions";
import { safeLandingPath } from "@/lib/rbac";
import { handOffEmail } from "@/modules/auth/email-handoff";
import { legalHref } from "@/modules/legal/documents";

type Errors = Record<string, string | undefined>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ["Account", "Organization", "Region", "Your profile", "Plan"];
const LAST = STEP_LABELS.length - 1;

/** `CURRENCIES` are display strings like `"USD — US Dollar"`; the server wants the code. */
const codeOf = (s: string) => s.split("—")[0]?.trim() || undefined;

/**
 * The picked country's ISO code — what the org-request contract documents — not its display name.
 * "Other" has none and is sent as nothing (QA audit 2026-10-08, WP-392).
 */
const isoOf = (name: string) => COUNTRY_CODES.find((c) => c.name === name)?.iso;

/**
 * The workspace ID while it is being typed: `slugify` without its trailing-dash trim, which removed
 * a dash or space the moment it was typed — `acme-inc` came out `acmeinc` (QA audit 2026-10-08,
 * WP-384). The full `slugify` still runs on what is shown as the result and on what is sent.
 */
const slugDraft = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "");

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
}: {
  authenticated?: boolean;
  onSubmitted?: () => void;
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
    slug: "",
    industry: "",
    size: "",
    website: "",
    prefix: "",
  });
  const [slugTouched, setSlugTouched] = useState(false);
  /** Set once the employee-ID prefix is typed — after that the org name no longer rewrites it. */
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [region, setRegion] = useState({ country: "", currency: "", timezone: "" });
  const [profile, setProfile] = useState({
    fullName: "",
    jobTitle: "",
    department: "",
    location: "",
    phone: "",
    dateOfBirth: "",
    workMode: "",
  });
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [plan, setPlan] = useState("free");
  const [consent, setConsent] = useState(false);
  /** The Terms of Service + Privacy Policy agreement, on the last step. See the note there. */
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [planInfoOpen, setPlanInfoOpen] = useState(false);

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
      // Only the public flow chooses a workspace ID; a request is given one at approval.
      if (!authenticated && !slugify(org.slug || org.name))
        e["org-slug"] = "Enter a valid workspace ID";
      // Only the public flow claims a prefix; an approved request gets one assigned at approval.
      if (!authenticated && !normalizeEmpPrefix(org.prefix))
        e["org-prefix"] = `Enter an employee ID prefix (1–${EMP_PREFIX_MAX} letters or digits)`;
      if (!org.industry) e["org-industry"] = "Choose your industry";
      if (!org.size) e["org-size"] = "Choose your organization size";
    }
    if (s === 2) {
      if (!region.country) e["org-country"] = "Choose your headquarters country";
      if (!region.currency) e["org-currency"] = "Choose your billing currency";
    }
    if (s === 3) {
      // **Every field on this step is required**, which it was not before: job title was the
      // only check and the rest were marked "Optional". The result is visible on any profile card
      // in the product — contact number, date of birth, work mode all reading "—", because nobody
      // returns to Settings to fill in what they were told they could skip. Asking once, here, is
      // the only moment the answer is cheap.
      if (!profile.jobTitle.trim()) e["me-title"] = "Enter your job title";
      if (!profile.location.trim()) e["me-location"] = "Enter your work location";
      // Digits only: `PhoneInput` emits `+<dial><national>`, so a country picked with no number
      // typed leaves a bare `+91` — present, and not a phone number.
      if (profile.phone.replace(/[^\d]/g, "").length < 6)
        e["me-phone"] = "Enter your contact number";
      if (!profile.dateOfBirth) e["me-dob"] = "Enter your date of birth";
      if (!profile.workMode) e["me-workmode"] = "Choose how you work";
    }
    if (s === 4) {
      if (!plan) e["org-plan"] = "Choose a plan";
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

    // The signed-in variant creates nothing: it submits a request that WorkPulse staff approve.
    //
    // Every field the wizard collected is carried through — `POST /v1/org/requests` stores them and
    // replays them into the org at approval — so the applicant fills this in once and none of it is
    // quietly dropped between asking and the workspace being built. No account block: the identity
    // came from Google. No `slug`/`emp_id_prefix`, and no plan: the request has no field for them —
    // the server derives the first two at approval and starts every approved org on Free — so this
    // variant no longer asks for a workspace ID or a plan it would then drop (QA audit 2026-10-08,
    // WP-128).
    if (authenticated) {
      try {
        await requestOrg({
          org_name: org.name.trim(),
          owner_name: (profile.fullName || acct.name).trim() || undefined,
          industry: org.industry || undefined,
          size: org.size || undefined,
          website: org.website.trim() || undefined,
          country: isoOf(region.country),
          currency: codeOf(region.currency),
          timezone:
            region.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
          job_title: profile.jobTitle.trim() || undefined,
          department: profile.department.trim() || undefined,
          location: profile.location.trim() || undefined,
          phone: profile.phone.trim() || undefined,
          date_of_birth: profile.dateOfBirth || undefined,
          work_mode: profile.workMode || undefined,
          // The authorisation tick was required and then sent nowhere (QA audit 2026-10-08, WP-128).
          monitoring_consent: consent,
        });
        onSubmitted?.();
      } catch (e) {
        setSubmitting(false);
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't submit your request. Please try again.",
        );
      }
      return;
    }

    try {
      const created = await createOrg({
        org: {
          name: org.name.trim(),
          slug: slugify(org.slug || org.name),
          // Required by the server, which claims it globally (`SYS#EMPPFX`). The field on the
          // organization step is prefilled from the org name and editable: it used to be derived
          // silently, so "Tesla Robotics" after "Test Org" collided on `TES` with nothing to change,
          // and a name with no ASCII letters produced no prefix at all (QA audit WP-031).
          emp_id_prefix: normalizeEmpPrefix(org.prefix),
          monitoring_consent: consent,
          industry: org.industry || undefined,
          size: org.size || undefined,
          website: org.website.trim() || undefined,
          country: isoOf(region.country),
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
          date_of_birth: profile.dateOfBirth || undefined,
          work_mode: profile.workMode || undefined,
        },
        plan,
      });
      // The org and the owner's Cognito login both exist now, so sign them straight in rather than
      // bouncing to /login to ask for a password they set thirty seconds ago.
      //
      // A failure here is NOT a signup failure — the account is real either way — so it never
      // surfaces as an error. It falls back to the sign-in page with the email prefilled (handed
      // over in sessionStorage, not as `?email=` in the URL — WP-390).
      try {
        await login(acct.email.trim().toLowerCase(), acct.password);
        toast.success("Workspace created", {
          description: `${created.slug} is ready.`,
        });
        // Straight to the dashboard — the register flow already collected everything, and the org
        // now ships with the standard departments seeded server-side (create_org), so there's no
        // setup wizard left to run. Invites happen from Employees → Invite when the owner is ready.
        router.replace("/dashboard");
      } catch {
        toast.success("Workspace created", {
          description: "Sign in with your new password to continue.",
        });
        handOffEmail(acct.email.trim().toLowerCase());
        router.replace("/login");
      }
    } catch (e) {
      setSubmitting(false);
      // Two different 409s, and they need different instructions — branch on the server's code, not
      // the status. `slug_taken` means change the workspace address; `email_taken` means this email
      // already has an account, and telling that person to pick another workspace address sends them
      // round the loop forever. (`email_taken` is new: create_org used to adopt an existing login
      // instead of refusing, which is the account-takeover this replaced.)
      const emailTaken = e instanceof ApiError && e.code === "email_taken";
      // The prefix and the address are separate claims with separate fixes. The server now names
      // which one is taken; `slug_or_emp_prefix_taken` remains for the rare race it can't attribute.
      const prefixTaken = e instanceof ApiError && e.code === "emp_prefix_taken";
      const eitherTaken = e instanceof ApiError && e.code === "slug_or_emp_prefix_taken";
      const msg =
        e instanceof ApiError && e.status === 409
          ? emailTaken
            ? "An account already uses that email. Sign in instead, or use a different address."
            : prefixTaken
              ? "Another organization already uses that employee ID prefix — go back and choose another."
              : eitherTaken
                ? "That workspace ID or employee ID prefix was just taken — go back and change one of them."
                : "That workspace ID is already taken — go back and try another."
          : e instanceof ApiError
            ? e.message
            : "Couldn't create your workspace. Try again.";
      // Anchor the message to the field that actually caused it. The error summary collects every
      // key regardless of step, so this shows either way — but keying it to `signup-email` also
      // marks the input itself, and stepping back to 0 is what makes that visible. Wizard state is
      // all held in this component, so nothing entered on steps 1-4 is lost going back.
      const field = emailTaken
        ? "signup-email"
        : prefixTaken
          ? "org-prefix"
          : e instanceof ApiError && e.status === 409
            ? "org-slug"
            : "org-plan";
      setErrors({ [field]: msg });
      if (emailTaken) setStep(0);
      else if (field !== "org-plan") setStep(1);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  // The signed-in variant is FOR an authenticated caller, so it must not blank itself the way the
  // public form does while its redirect lands. The effect above was exempted for it and this guard
  // was not, so every "Continue with Google" user with no organization — and every rejected
  // applicant pressing "Submit a new request" — got a page with a logo and nothing else
  // (QA audit 2026-10-08, WP-029).
  if (hydrated && isAuthenticated && !authenticated) return null;

  const summary = Object.entries(errors).filter(([, v]) => Boolean(v)) as [string, string][];
  const previewSlug = slugify(org.slug || org.name);

  const HEADINGS: [string, string][] = [
    authenticated
      ? ["Request your workspace", "A member of the WorkPulse team reviews each request."]
      : ["Create your workspace", "You'll be the owner — you can invite your team next."],
    [
      "About your organization",
      authenticated ? "This names your workspace." : "This names your workspace and sets its ID.",
    ],
    ["Region & localization", "How WorkPulse formats time and currency for your teams."],
    ["Your profile", "How your team sees you. Everything here is editable later."],
    authenticated
      ? ["Your plan", "Every approved workspace starts on the Free plan."]
      : ["Choose a plan", "Free while in beta — no card required."],
  ];

  return (
    <>
      <AuthFrame
        headline="Set your organization"
        headlineAccent="in motion today"
        copy="Free while in beta, no card required. Create your workspace, invite your team, and have time and attendance running the same afternoon."
      >
        <AuthHeading title={HEADINGS[step][0]} subtitle={HEADINGS[step][1]} />
        {/* Drop the skipped step from the indicator entirely rather than showing it greyed: a
            "Step 2 of 5" that can never reach step 1 reads as something the user failed to do. */}
        <AuthSteps steps={STEP_LABELS.slice(FIRST)} current={step - FIRST} />

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
                  setOrg((s) => ({
                    ...s,
                    name: v,
                    slug: slugTouched ? s.slug : slugify(v),
                    prefix: prefixTouched ? s.prefix : (empPrefixCandidates(v)[0] ?? ""),
                  }));
                  clear("org-name");
                }}
                error={errors["org-name"]}
                autoComplete="organization"
              />
              {/* Public flow only — a request is given its ID at approval. Named an ID, not an
                  address: there is no `<id>.workpulse.io`, which the hint used to promise (WP-128). */}
              {!authenticated ? (
                <AuthField
                  id="org-slug"
                  label="Workspace ID"
                  value={org.slug}
                  onChange={(v) => {
                    setSlugTouched(true);
                    setOrg((s) => ({ ...s, slug: slugDraft(v) }));
                    clear("org-slug");
                  }}
                  error={errors["org-slug"]}
                  hint={
                    previewSlug
                      ? `Your workspace's unique ID: ${previewSlug}`
                      : "Letters, numbers and dashes."
                  }
                  autoCapitalize="none"
                  spellCheck={false}
                />
              ) : null}
              {!authenticated ? (
                <AuthField
                  id="org-prefix"
                  label="Employee ID prefix"
                  value={org.prefix}
                  onChange={(v) => {
                    setPrefixTouched(true);
                    setOrg((s) => ({ ...s, prefix: normalizeEmpPrefix(v) }));
                    clear("org-prefix");
                  }}
                  error={errors["org-prefix"]}
                  hint={`Starts every employee ID, like ${normalizeEmpPrefix(org.prefix) || "INF"}-0001. Up to ${EMP_PREFIX_MAX} letters or digits, unique to your organization.`}
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              ) : null}
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
            </>
          ) : null}

          {/* ---------------- 3 · Region ---------------- */}
          {step === 2 ? (
            <>
              <div className="m-afield">
                <span className="m-acap">Headquarters country</span>
                <MSelect
                  id="org-country"
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
                    id="org-currency"
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
                  onChange={(v) => {
                    setProfile((s) => ({ ...s, location: v }));
                    clear("me-location");
                  }}
                  error={errors["me-location"]}
                />
              </div>
              <AuthField
                id="me-phone"
                label="Contact number"
                value={profile.phone}
                onChange={(v) => {
                  setProfile((s) => ({ ...s, phone: v }));
                  clear("me-phone");
                }}
                error={errors["me-phone"]}
                // The country picker replaces the plain input. It borrows this page's own control
                // styling (`m-authinput`) rather than the app tokens it uses elsewhere — the auth
                // pages are a separate system, and a 2.25rem token-styled box beside these 2.75rem
                // fields reads as a rendering fault rather than a different control.
                control={
                  <PhoneInput
                    id="me-phone"
                    value={profile.phone}
                    onChange={(v) => {
                      setProfile((s) => ({ ...s, phone: v }));
                      clear("me-phone");
                    }}
                    className="w-full"
                    triggerClassName="m-authinput h-11 w-auto rounded-r-none border-r-0"
                    inputClassName="m-authinput h-11 rounded-l-none"
                  />
                }
              />
              <div className="m-arow">
                <AuthField
                  id="me-dob"
                  label="Date of birth"
                  value={profile.dateOfBirth}
                  onChange={(v) => {
                    setProfile((s) => ({ ...s, dateOfBirth: v }));
                    clear("me-dob");
                  }}
                  error={errors["me-dob"]}
                  control={
                    <DatePicker
                      // The id the label and the error summary point at — the picker had none (WP-389).
                      id="me-dob"
                      value={profile.dateOfBirth}
                      onChange={(v) => {
                        setProfile((s) => ({ ...s, dateOfBirth: v }));
                        clear("me-dob");
                      }}
                      // Nobody signing up was born after today, and 1900 is the floor the server
                      // enforces — offering years it will reject is a round trip to learn nothing.
                      max={todayIso()}
                      min="1900-01-01"
                      className="m-authinput h-11 w-full"
                    />
                  }
                />
                <AuthField
                  id="me-workmode"
                  label="Work mode"
                  value={profile.workMode}
                  onChange={(v) => {
                    setProfile((s) => ({ ...s, workMode: v }));
                    clear("me-workmode");
                  }}
                  error={errors["me-workmode"]}
                  control={
                    <select
                      id="me-workmode"
                      value={profile.workMode}
                      onChange={(e) => {
                        setProfile((s) => ({ ...s, workMode: e.target.value }));
                        clear("me-workmode");
                      }}
                      className="m-authinput"
                    >
                      <option value="">Select…</option>
                      {/* The exact strings `shared::profile::WORK_MODES` accepts. */}
                      <option value="on-site">On-site</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="remote">Remote</option>
                    </select>
                  }
                />
              </div>
            </>
          ) : null}

          {/* ---------------- 5 · Plan ---------------- */}
          {step === 4 ? (
            <>
              {authenticated ? (
                // The request has no plan field and approval creates every org on Free, so this
                // variant states that instead of offering a choice it would drop (WP-128).
                <p className="m-anote">
                  Your workspace starts on the Free plan. Once it&apos;s approved, you can change plan
                  any time in Settings → Billing.
                </p>
              ) : (
              <>
              <div className="m-planbar">
                {/* `aria-pressed`: the selected period was signalled only by a `data-on` style (WP-389). */}
                <div className="m-billtoggle" role="group" aria-label="Billing period">
                  <button
                    type="button"
                    data-on={billing === "monthly"}
                    aria-pressed={billing === "monthly"}
                    onClick={() => setBilling("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    data-on={billing === "annual"}
                    aria-pressed={billing === "annual"}
                    onClick={() => setBilling("annual")}
                  >
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
                        // The error summary's `#org-plan` lands on the chosen radio.
                        id={plan === pl.id ? "org-plan" : undefined}
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
              </>
              )}

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
                  included. The acceptance is not sent to the server yet: neither `POST /v1/org/create`
                  nor `POST /v1/org/requests` has a field for it. */}
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
                  {authenticated ? "Sending your request…" : "Creating…"}
                </>
              ) : step === LAST ? (
                authenticated ? (
                  "Submit request"
                ) : (
                  "Create workspace"
                )
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
