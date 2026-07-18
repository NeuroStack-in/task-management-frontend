"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  ImagePlus,
  KeyRound,
  Loader2,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { GoogleIcon, MicrosoftIcon } from "@/modules/marketing/brand-icons";
import { slugify as serverSlugify } from "@/modules/auth/services/signup.service";

/* ----------------------------- options ------------------------------- */

const INDUSTRIES = [
  "Software / SaaS", "Field service", "Construction", "Healthcare",
  "Agency / Consulting", "Retail & hospitality", "Finance", "Manufacturing",
  "Logistics & transport", "Education", "Government / Public sector", "Other",
];
const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,000–5,000", "5,000+"];
const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "India",
  "Germany", "France", "Singapore", "United Arab Emirates", "Other",
];
const CURRENCIES = [
  "USD — US Dollar", "EUR — Euro", "GBP — British Pound", "INR — Indian Rupee",
  "AUD — Australian Dollar", "SGD — Singapore Dollar", "AED — UAE Dirham", "CAD — Canadian Dollar",
];
const TIMEZONES = [
  "(GMT−08:00) Pacific Time", "(GMT−05:00) Eastern Time", "(GMT+00:00) London / GMT",
  "(GMT+01:00) Central Europe", "(GMT+04:00) Gulf Standard", "(GMT+05:30) India Standard",
  "(GMT+08:00) Singapore", "(GMT+10:00) Sydney",
];
const COUNTRY_CURRENCY: Record<string, string> = {
  "United States": "USD — US Dollar",
  "United Kingdom": "GBP — British Pound",
  Canada: "CAD — Canadian Dollar",
  Australia: "AUD — Australian Dollar",
  India: "INR — Indian Rupee",
  Germany: "EUR — Euro",
  France: "EUR — Euro",
  Singapore: "SGD — Singapore Dollar",
  "United Arab Emirates": "AED — UAE Dirham",
};

/**
 * The `id`s here are the contract — they're what gets sent to the server, which accepts
 * exactly `free | starter | enterprise` (`Plan` in `crates/wp-contracts/src/plans.rs`,
 * serialized lowercase). They were `free | pro | max`: two of the three would have been
 * rejected outright once signup talks to a real API.
 */
const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    tagline: "For individuals and very small teams getting started.",
    features: [
      "Core time tracking & timesheets",
      "Up to 5 members",
      "1 active project",
      "7-day activity history",
    ],
    featured: false,
  },
  {
    id: "starter",
    name: "Starter",
    monthly: 12,
    annual: 10,
    tagline: "For growing teams that need real insight.",
    features: [
      "Time tracking, attendance & timesheets",
      "Activity & productivity analytics",
      "Unlimited projects & tasks",
      "Reports, dashboards & exports",
      "Priority support",
    ],
    featured: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: 22,
    annual: 18,
    tagline: "For organizations operating at scale.",
    features: [
      "Everything in Starter",
      "SSO / SAML & SCIM provisioning",
      "AI anomaly & burnout detection",
      "Audit logs, DPA & data residency",
      "Advanced security & roles",
      "Custom contracts & premier SLA",
      "Dedicated success manager",
    ],
    featured: true,
  },
];

const STEPS = [
  { key: "org", label: "Organization", icon: Building2 },
  { key: "region", label: "Region & localization", icon: Globe },
  { key: "profile", label: "Your profile", icon: UserRound },
  { key: "plan", label: "Plan", icon: Check },
];

/* ------------------------------ MModal ------------------------------- */

function MModal({
  open,
  onClose,
  children,
  maxW = "max-w-lg",
  dismissable = true,
  backdropClose = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxW?: string;
  dismissable?: boolean;
  backdropClose?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgb(22 32 43 / 0.45)", backdropFilter: "blur(6px)" }}
        onClick={dismissable && backdropClose ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`m-card m-root m-enter-scale relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden ${maxW}`}
        style={{ boxShadow: "0 50px 110px -40px rgb(18 28 40 / 0.5)" }}
      >
        {dismissable ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--m-text)_8%,transparent)]"
            style={{ color: "var(--m-muted)" }}
          >
            <X className="size-4" />
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/* ---------------------- Custom dropdown (themed) --------------------- *
 *  Native <select> popups are OS-drawn and unthemeable. This menu is     *
 *  portalled to <body> (escapes the modal transform), repositions on     *
 *  scroll/resize (instead of closing), flips up near the viewport edge,  *
 *  and adds type-ahead search for longer lists.                          */

function MSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    maxH: number;
    up: boolean;
    top?: number;
    bottom?: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchable = options.length > 7;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = below < 240 && above > below;
      const maxH = Math.max(160, Math.min(300, up ? above : below));
      setPos({
        left: r.left,
        width: r.width,
        maxH,
        up,
        top: up ? undefined : r.bottom + 6,
        bottom: up ? window.innerHeight - r.top + 6 : undefined,
      });
    };
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // reposition, do NOT close
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="m-trigger"
        data-open={open}
        data-placeholder={!value}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className="size-4" />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="m-menu m-root"
              role="listbox"
              style={{
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxH,
                top: pos.top,
                bottom: pos.bottom,
                transformOrigin: pos.up ? "bottom center" : "top center",
              }}
            >
              {searchable ? (
                <div className="m-menu-search">
                  <Search className="size-4 shrink-0" style={{ color: "var(--m-faint)" }} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                    aria-label="Search options"
                  />
                </div>
              ) : null}
              <div className="m-menu-list">
                {filtered.length ? (
                  filtered.map((o) => (
                    <button
                      key={o}
                      type="button"
                      role="option"
                      aria-selected={o === value}
                      data-on={o === value}
                      className="m-menu-item"
                      onClick={() => {
                        onChange(o);
                        setOpen(false);
                      }}
                    >
                      <span>{o}</span>
                      {o === value ? <Check className="size-3.5 shrink-0" /> : null}
                    </button>
                  ))
                ) : (
                  <p className="m-menu-empty">No matches</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* -------------------------- SSO account picker ------------------------ */

export function SsoPickerModal({
  provider,
  onClose,
  onPicked,
}: {
  provider: "google" | "microsoft" | null;
  onClose: () => void;
  onPicked: () => void;
}) {
  const isGoogle = provider === "google";
  const accounts = [
    { name: "Alex Morgan", email: "alex@acme.com", initials: "AM" },
    { name: "Sam Rivera", email: "sam@acme.com", initials: "SR" },
  ];
  return (
    <MModal open={!!provider} onClose={onClose} maxW="max-w-sm">
      <div className="p-7">
        <div className="flex items-center gap-2">
          {isGoogle ? <GoogleIcon className="size-5" /> : <MicrosoftIcon className="size-5" />}
          <span className="text-sm font-medium">
            {isGoogle ? "Sign in with Google" : "Sign in with Microsoft"}
          </span>
        </div>
        <h2 className="m-display mt-4 text-xl font-semibold">Choose an account</h2>
        <p className="text-sm" style={{ color: "var(--m-muted)" }}>
          to continue to WorkPulse
        </p>

        <ul className="mt-4 divide-y" style={{ borderColor: "var(--m-border)" }}>
          {accounts.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={onPicked}
                className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80"
              >
                <span
                  className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: "var(--m-accent-tint)", color: "var(--m-accent-ink)" }}
                >
                  {a.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--m-muted)" }}>
                    {a.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={onPicked}
              className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80"
            >
              <span
                className="flex size-9 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--m-border-strong)", color: "var(--m-muted)" }}
              >
                <UserPlus className="size-4" />
              </span>
              <span className="text-sm font-medium">Use another account</span>
            </button>
          </li>
        </ul>
        <p className="mt-4 text-xs" style={{ color: "var(--m-faint)" }}>
          Demo only — no real authentication occurs.
        </p>
      </div>
    </MModal>
  );
}

/* ---------------------- SSO provider options ------------------------ */

export function SsoOptionsModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (provider: "google" | "microsoft" | "saml") => void;
}) {
  const opts: { id: "google" | "microsoft" | "saml"; label: string; icon: React.ReactNode }[] = [
    { id: "google", label: "Continue with Google", icon: <GoogleIcon className="size-5" /> },
    { id: "microsoft", label: "Continue with Microsoft", icon: <MicrosoftIcon className="size-5" /> },
    {
      id: "saml",
      label: "Continue with SAML / Enterprise SSO",
      icon: <KeyRound className="size-5" style={{ color: "var(--m-muted)" }} />,
    },
  ];
  return (
    <MModal open={open} onClose={onClose} maxW="max-w-sm">
      <div className="p-7">
        <h2 className="m-display text-xl font-semibold">Continue with SSO</h2>
        <p className="text-sm" style={{ color: "var(--m-muted)" }}>
          Choose your identity provider to continue.
        </p>
        <div className="mt-5 space-y-2.5">
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onPick(o.id)}
              className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors"
              style={{ borderColor: "var(--m-border-strong)", background: "var(--m-surface)" }}
            >
              <span className="shrink-0">{o.icon}</span>
              <span className="text-sm font-medium">{o.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs" style={{ color: "var(--m-faint)" }}>
          Demo only — no real authentication occurs.
        </p>
      </div>
    </MModal>
  );
}

/* ----------------------- Plan confirmation popup --------------------- */

function PayConfirm({
  planId,
  billing,
  status,
  onConfirm,
  onClose,
}: {
  planId: string;
  billing: "monthly" | "annual";
  status: "idle" | "loading" | "success";
  onConfirm: () => void;
  onClose: () => void;
}) {
  const pl = PLANS.find((p) => p.id === planId);
  if (typeof document === "undefined" || !pl) return null;
  const price = billing === "annual" ? pl.annual : pl.monthly;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgb(22 32 43 / 0.5)", backdropFilter: "blur(6px)" }}
        onClick={status === "idle" ? onClose : undefined}
      />
      <div
        className="m-card m-root m-enter-scale relative z-10 w-full max-w-sm p-6"
        style={{ boxShadow: "0 44px 96px -36px rgb(18 28 40 / 0.55)" }}
      >
        <div
          className="flex size-11 items-center justify-center rounded-xl"
          style={{ background: "var(--m-accent-tint)", color: "var(--m-accent-ink)" }}
        >
          <CreditCard className="size-5" />
        </div>
        <h3 className="m-display mt-4 text-xl font-semibold">Confirm your plan</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--m-muted)" }}>
          Review your subscription before we set things up.
        </p>

        <div
          className="mt-4 rounded-xl border p-4"
          style={{ borderColor: "var(--m-border)", background: "var(--m-surface-2)" }}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">WorkPulse {pl.name}</span>
            <span className="m-display text-lg font-semibold">
              ${price}
              <span className="text-xs font-normal" style={{ color: "var(--m-muted)" }}> / user / mo</span>
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--m-muted)" }}>
            Billed {billing === "annual" ? "annually" : "monthly"} · per active user
          </p>
        </div>

        <ul className="mt-4 space-y-2 text-xs" style={{ color: "var(--m-muted)" }}>
          {[
            "14-day free trial — you won't be charged today",
            "Cancel anytime before the trial ends",
            `Renews at $${price}/user/mo after the trial`,
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--m-accent-ink)" }} />
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} disabled={status !== "idle"} className="m-btn m-btn-ghost flex-1">
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={status !== "idle"}
            className="m-btn m-btn-primary flex-1"
            style={status === "success" ? { background: "var(--m-success)", color: "#fff" } : undefined}
          >
            {status === "loading" ? (
              <>
                <Loader2 className="m-spin size-4" /> Setting up…
              </>
            ) : status === "success" ? (
              <>
                <Check className="size-4" /> All set
              </>
            ) : (
              <>
                Confirm <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-[0.7rem]" style={{ color: "var(--m-faint)" }}>
          Secure checkout · no card charged during the trial
        </p>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------ Organization setup ------------------------- */

/**
 * The server's own normalisation (shared, so the previewed workspace URL is the one that gets
 * stored), plus a 24-char cap that is purely ours — a suggestion while typing, and still editable.
 */
const slugify = (s: string) => serverSlugify(s).slice(0, 24);

/**
 * Everything the wizard collects that `POST /v1/org/create` accepts. The owner's email/password
 * aren't here — they were captured on the signup form before this modal opened.
 */
export interface OrgSetupData {
  org: {
    name: string;
    slug: string;
    industry?: string;
    size?: string;
    website?: string;
    timezone?: string;
    country?: string;
    currency?: string;
  };
  owner: {
    full_name?: string;
    job_title?: string;
    department?: string;
    location?: string;
    phone?: string;
  };
  plan: string;
}

export function OrgSetupModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  /** Rejects to keep the wizard open and show the failure. */
  onComplete: (data: OrgSetupData) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [err, setErr] = useState<string | null>(null);

  const [org, setOrg] = useState({ name: "", slug: "", industry: "", size: "", website: "", logo: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [region, setRegion] = useState({ country: "", currency: "", timezone: "" });
  const [profile, setProfile] = useState({
    fullName: "", jobTitle: "", department: "", location: "", phone: "", avatar: "",
  });
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [plan, setPlan] = useState("");
  const [consent, setConsent] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const logoInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const setName = (v: string) =>
    setOrg((o) => ({ ...o, name: v, slug: slugTouched ? o.slug : slugify(v) }));

  // Selecting a headquarters country pre-fills the matching billing currency.
  const setCountry = (v: string) =>
    setRegion((r) => ({ ...r, country: v, currency: COUNTRY_CURRENCY[v] ?? r.currency }));

  const readImage = (file: File | undefined, apply: (data: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => apply(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const next = () => {
    setErr(null);
    if (step === 0) {
      if (!org.name.trim() || !org.slug.trim() || !org.industry || !org.size)
        return setErr("Add your organization name, workspace URL, industry and size.");
    }
    if (step === 1) {
      if (!region.country || !region.currency)
        return setErr("Select your headquarters country and billing currency.");
    }
    if (step === 2) {
      if (!profile.fullName.trim() || !profile.jobTitle.trim())
        return setErr("Add your name and job title.");
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submitPlan = () => {
    if (!plan) return setErr("Select a plan to continue.");
    if (!consent) return setErr("Please confirm the monitoring authorization to continue.");
    setErr(null);
    if (plan === "free") {
      doFinish(); // free plan needs no payment confirmation
      return;
    }
    setPayOpen(true);
  };

  // Hands the collected setup up to be committed (`POST /v1/org/create`) and reflects the real
  // outcome: a failure returns to the form with the server's message rather than a fake success.
  const doFinish = async () => {
    setStatus("loading");
    setErr(null);
    try {
      await onComplete({
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
          full_name: profile.fullName.trim() || undefined,
          job_title: profile.jobTitle.trim() || undefined,
          department: profile.department.trim() || undefined,
          location: profile.location.trim() || undefined,
          phone: profile.phone.trim() || undefined,
        },
        plan,
      });
      setStatus("success");
    } catch (e) {
      setStatus("idle");
      setErr(e instanceof Error ? e.message : "Couldn't create your workspace. Try again.");
    }
  };

  const StepIcon = STEPS[step].icon;

  return (
    <>
      <MModal open={open} onClose={onClose} maxW="max-w-2xl" backdropClose={false}>
        {/* Header + stepper */}
        <div className="shrink-0 border-b p-5 pr-12" style={{ borderColor: "var(--m-border)" }}>
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-lg"
              style={{ background: "var(--m-accent-tint)", color: "var(--m-accent-ink)" }}
            >
              <StepIcon className="size-4" />
            </span>
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Set up your workspace
            </p>
          </div>
          <h2 className="m-display mt-1.5 text-xl font-semibold">{STEPS[step].label}</h2>

          <ol className="mt-4 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.key} className="flex flex-1 items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold transition-colors"
                    style={{
                      background: done || active ? "var(--m-accent)" : "var(--m-surface-2)",
                      color: done || active ? "var(--m-on-accent)" : "var(--m-faint)",
                    }}
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span
                      className="h-0.5 flex-1 rounded-full transition-colors"
                      style={{ background: i < step ? "var(--m-accent)" : "var(--m-surface-2)" }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        {/* Body (scrolls) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {/* Step 0 — Organization */}
          {step === 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors"
                  style={{ borderColor: "var(--m-border-strong)", color: "var(--m-faint)" }}
                >
                  {org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logo} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus className="size-5" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium">Organization logo</p>
                  <p className="text-xs" style={{ color: "var(--m-muted)" }}>
                    PNG or SVG, square works best. Optional.
                  </p>
                </div>
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => readImage(e.target.files?.[0], (d) => setOrg((o) => ({ ...o, logo: d }))) }
                />
              </div>

              <Field label="Organization name">
                <input className="m-input" value={org.name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
              </Field>

              <Field label="Organization URL">
                <div className="m-input-affix">
                  <input
                    value={org.slug}
                    onChange={(e) => { setSlugTouched(true); setOrg((o) => ({ ...o, slug: slugify(e.target.value) })); }}
                    placeholder="acme"
                    aria-label="Organization URL"
                  />
                  <span className="m-suffix">.workpulse.io</span>
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Industry">
                  <MSelect value={org.industry} onChange={(v) => setOrg({ ...org, industry: v })} options={INDUSTRIES} ariaLabel="Industry" />
                </Field>
                <Field label="Organization size">
                  <MSelect value={org.size} onChange={(v) => setOrg({ ...org, size: v })} options={SIZES} ariaLabel="Organization size" />
                </Field>
              </div>

              <Field label="Organization website" hint="Optional">
                <input className="m-input" value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} placeholder="https://acme.com" />
              </Field>
            </div>
          ) : null}

          {/* Step 1 — Region & localization */}
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--m-muted)" }}>
                Set your headquarters and how WorkPulse formats time and currency for your teams.
              </p>
              <Field label="Headquarters country">
                <MSelect value={region.country} onChange={setCountry} options={COUNTRIES} ariaLabel="Headquarters country" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default timezone" hint="Optional">
                  <MSelect value={region.timezone} onChange={(v) => setRegion({ ...region, timezone: v })} options={TIMEZONES} ariaLabel="Default timezone" />
                </Field>
                <Field label="Billing currency">
                  <MSelect value={region.currency} onChange={(v) => setRegion({ ...region, currency: v })} options={CURRENCIES} ariaLabel="Billing currency" />
                </Field>
              </div>
            </div>
          ) : null}

          {/* Step 2 — Your profile (organization lead / manager) */}
          {step === 2 ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => avatarInput.current?.click()}
                  className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors"
                  style={{ borderColor: "var(--m-border-strong)", color: "var(--m-faint)" }}
                >
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium">
                    Profile picture <span style={{ color: "var(--m-faint)", fontWeight: 400 }}>· optional</span>
                  </p>
                  <p className="text-xs" style={{ color: "var(--m-muted)" }}>As the workspace owner, this is how your team sees you.</p>
                </div>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => readImage(e.target.files?.[0], (d) => setProfile((p) => ({ ...p, avatar: d }))) }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input className="m-input" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} placeholder="Jordan Avery" autoComplete="name" />
                </Field>
                <Field label="Job title">
                  <input className="m-input" value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} placeholder="Head of Operations" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" hint="Optional">
                  <input className="m-input" value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} placeholder="Operations" />
                </Field>
                <Field label="Work location" hint="Optional">
                  <input className="m-input" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="San Francisco, CA" />
                </Field>
              </div>
              <Field label="Work phone" hint="Optional">
                <input className="m-input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 555 000 1234" />
              </Field>
            </div>
          ) : null}

          {/* Step 3 — Plan & consent */}
          {step === 3 ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm" style={{ color: "var(--m-muted)" }}>
                  Every plan includes the full platform. Pick the support and security tier you need.
                </p>
                <div className="m-seg shrink-0">
                  <button type="button" data-on={billing === "monthly"} onClick={() => setBilling("monthly")}>Monthly</button>
                  <button type="button" data-on={billing === "annual"} onClick={() => setBilling("annual")}>
                    Annual <span style={{ color: "var(--m-accent-ink)" }}>−17%</span>
                  </button>
                </div>
              </div>

              {/* Free-trial banner */}
              <div
                className="mt-3 flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-medium"
                style={{
                  borderColor: "color-mix(in srgb, var(--m-accent) 30%, transparent)",
                  background: "var(--m-accent-tint)",
                  color: "var(--m-accent-ink)",
                }}
              >
                <BadgeCheck className="size-4 shrink-0" />
                Start free, or try Starter &amp; Enterprise free for 14 days — no card required.
              </div>

              <div className="mt-3 grid gap-2">
                {PLANS.map((pl) => {
                  const on = plan === pl.id;
                  const free = pl.monthly === 0;
                  const price = billing === "annual" ? pl.annual : pl.monthly;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => setPlan(pl.id)}
                      className="w-full rounded-2xl border p-3 text-left transition-colors sm:p-3.5"
                      style={{
                        borderColor: on ? "var(--m-accent)" : "var(--m-border-strong)",
                        background: on ? "var(--m-accent-tint)" : "var(--m-surface)",
                        boxShadow: on ? "inset 0 0 0 1px var(--m-accent)" : "none",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border"
                          style={{
                            borderColor: on ? "var(--m-accent)" : "var(--m-border-strong)",
                            background: on ? "var(--m-accent)" : "transparent",
                            color: "var(--m-on-accent)",
                          }}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="m-display text-base font-semibold">{pl.name}</span>
                            {pl.featured ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold"
                                style={{ background: "var(--m-accent)", color: "var(--m-on-accent)" }}
                              >
                                Recommended
                              </span>
                            ) : null}
                            <span className="ml-auto whitespace-nowrap">
                              <span className="m-display text-xl font-semibold">{free ? "$0" : `$${price}`}</span>
                              <span className="text-xs" style={{ color: "var(--m-muted)" }}>
                                {free ? " forever" : ` / user / mo${billing === "annual" ? ", yearly" : ""}`}
                              </span>
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--m-muted)" }}>{pl.tagline}</p>
                          <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                            {pl.features.map((f) => (
                              <li key={f} className="flex items-start gap-2 text-xs">
                                <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--m-accent-ink)" }} />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Pinned footer — the required consent (Plan step) and any error stay
            visible above the actions, so nothing critical hides below the scroll. */}
        <div className="shrink-0 border-t" style={{ borderColor: "var(--m-border)" }}>
          {step === 3 ? (
            <label
              className="mx-4 mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3"
              style={{
                borderColor: consent ? "var(--m-accent)" : "var(--m-border-strong)",
                background: consent ? "var(--m-accent-tint)" : "var(--m-surface)",
              }}
            >
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                style={{
                  borderColor: consent ? "var(--m-accent)" : "var(--m-border-strong)",
                  background: consent ? "var(--m-accent)" : "transparent",
                  color: "var(--m-on-accent)",
                }}
              >
                {consent ? <Check className="size-3.5" /> : null}
              </span>
              <input type="checkbox" className="sr-only" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-xs leading-relaxed" style={{ color: "var(--m-muted)" }}>
                I&apos;m authorized to enable workforce activity monitoring for this organization and confirm team
                members will be informed in line with applicable law.
              </span>
            </label>
          ) : null}

          {err ? (
            <p className="mx-4 mt-2.5 text-xs" style={{ color: "var(--m-danger)" }} role="alert">
              {err}
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 p-4">
          {step > 0 ? (
            <button type="button" onClick={() => { setErr(null); setStep((s) => s - 1); }} className="m-btn m-btn-ghost" disabled={status !== "idle"}>
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : (
            <span className="text-xs" style={{ color: "var(--m-muted)" }}>14-day free trial · no card required</span>
          )}
          {step < 3 ? (
            <button type="button" onClick={next} className="m-btn m-btn-primary">
              Continue <ArrowRight className="size-4" />
            </button>
          ) : plan === "free" ? (
            <button
              type="button"
              onClick={submitPlan}
              disabled={status !== "idle"}
              className="m-btn m-btn-primary"
              style={status === "success" ? { background: "var(--m-success)", color: "#fff" } : undefined}
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="m-spin size-4" /> Creating organization…
                </>
              ) : status === "success" ? (
                <>
                  <Check className="size-4" /> Organization ready
                </>
              ) : (
                <>
                  Get started free <ArrowRight className="size-4" />
                </>
              )}
            </button>
          ) : (
            <button type="button" onClick={submitPlan} className="m-btn m-btn-primary">
              <CreditCard className="size-4" /> Proceed to pay
            </button>
          )}
          </div>
        </div>
      </MModal>

      {/* Plan confirmation popup */}
      {payOpen ? (
        <PayConfirm
          planId={plan}
          billing={billing}
          status={status}
          onConfirm={doFinish}
          onClose={() => {
            if (status === "idle") setPayOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------- fields ------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium" style={{ color: "var(--m-muted)" }}>{label}</span>
        {hint ? <span className="text-[0.7rem]" style={{ color: "var(--m-faint)" }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
