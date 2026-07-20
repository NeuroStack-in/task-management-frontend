"use client";

/**
 * Shared auth chrome — one split-screen frame behind every auth surface.
 *
 * Brand panel left (a dark stage for the clock), form right. Two things about the composition are
 * deliberate and easy to undo by accident:
 *
 * 1. **The form is first in DOM order** and moved to the right column by grid placement. Keyboard
 *    and screen-reader users reach the task immediately instead of tabbing through marketing copy.
 * 2. **The panel is fixed on the left for every screen.** It used to flip sides between login and
 *    signup, which made moving between them feel like changing product. There is no `brandSide`
 *    prop any more, on purpose.
 *
 * The form column is light rather than glass-on-photo. Translucent inputs over a moving backdrop is
 * the hardest surface in the app to hold contrast on, and it is exactly where someone types a
 * password; a light panel also makes signing in continuous with the (light) product behind it.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckSquare,
  Clock,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { ClockBackdrop } from "@/modules/marketing/clock-backdrop";

export interface AuthFeature {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** The product story, identical on every auth screen — recognition depends on it not moving. */
const FEATURES: AuthFeature[] = [
  {
    icon: Clock,
    title: "Time & attendance",
    body: "One-tap timer, clock-in and schedules that roll straight into payroll-ready timesheets.",
  },
  {
    icon: Users,
    title: "Projects & people",
    body: "Boards, assignments and approvals — with a directory that stays current on its own.",
  },
  {
    icon: Activity,
    title: "Calm activity insight",
    body: "Productivity signals presented as context for a conversation, never as surveillance.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "Invite-only access, role-based permissions and an audit trail behind every change.",
  },
];

export function AuthFrame({
  children,
  headline,
  headlineAccent,
  copy,
}: {
  children: React.ReactNode;
  /** First line of the brand headline. */
  headline: string;
  /** Second line, set in teal — the reference layout's two-tone display. */
  headlineAccent: string;
  copy: string;
}) {
  return (
    <div className="m-root m-auth">
      {/* ---- Form column (FIRST in the DOM; grid moves it right on desktop) ---- */}
      <main className="m-auth__form">
        <div className="m-auth__mobile-brand">
          <Link href="/" aria-label="WorkPulse home">
            <Logo />
          </Link>
        </div>

        <div className="m-auth__form-inner">
          <div className="m-auth__card m-auth-rise">{children}</div>
        </div>
        {/*
          No footer row here by design.

          It previously carried "Need help signing in?" plus Privacy and Terms links. WCAG 2.2
          SC 3.2.6 Consistent Help only binds when a help mechanism *is* offered across pages — it
          requires consistent placement, it does not require offering help at all — so removing the
          row outright is conformant, whereas keeping it on some auth screens and not others would
          not be. If a help link returns, it must go back on **all six** auth screens in this same
          position. The Terms and Privacy wording still appears where it legally matters: beside the
          consent checkbox on the sign-up step.
        */}
      </main>

      {/* ---- Brand panel ---- */}
      <aside className="m-auth__brand">
        {/* Dialled right down: the floating cards now carry the visual interest, so the dial is
            texture behind them rather than the subject. Posed, never sweeping — see `still`. */}
        <ClockBackdrop
          still
          className="aspect-square w-[min(115%,660px)]"
          top="26%"
          left="76%"
          glow="size-[30vw] max-w-[420px]"
          intensity={0.34}
        />

        {/* Floating product cards. Purely decorative, so they are hidden from assistive tech —
            they restate what the feature list already says in words. They sit inside the panel's
            `overflow: hidden`, which is what keeps them from widening the page. */}
        <div className="m-auth__cards" aria-hidden="true">
          <article className="m-authcard m-authcard--a">
            <header>
              <span className="m-authcard__icon">
                <Clock />
              </span>
              This week
            </header>
            <div className="m-authcard__row">
              <span>Tracked</span>
              <strong>32h 40m</strong>
            </div>
            <div className="m-authcard__bar">
              <span style={{ width: "68%" }} />
            </div>
            <div className="m-authcard__tags">
              <span>Acme website</span>
              <span>Onboarding</span>
            </div>
          </article>

          <article className="m-authcard m-authcard--b">
            <header>
              <span className="m-authcard__icon">
                <Users />
              </span>
              Team
              <span className="m-authcard__live">
                <i /> LIVE
              </span>
            </header>
            <div className="m-authcard__lines">
              <span />
              <span />
            </div>
            <div className="m-authcard__people">
              <i>P</i>
              <i>M</i>
              <i>S</i>
              <em>4 tracking now</em>
            </div>
          </article>

          <article className="m-authcard m-authcard--c">
            <header>
              <span className="m-authcard__icon">
                <CheckSquare />
              </span>
              Today
            </header>
            <ul className="m-authcard__todo">
              <li className="is-done">Design review</li>
              <li className="is-done">Standup notes</li>
              <li>Payroll check</li>
            </ul>
            <span className="m-authcard__chip">2 of 3 done</span>
          </article>
        </div>

        <div className="m-auth__brand-inner">
          <Link href="/" className="inline-flex" aria-label="WorkPulse home">
            <Logo className="text-white" size="lg" />
          </Link>

          <p className="m-auth__kicker">The workforce platform</p>

          <h2 className="m-display m-auth__headline">
            {headline}
            <span>{headlineAccent}</span>
          </h2>

          <p className="m-auth__lede">{copy}</p>

          <ul className="m-auth__features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="m-auth__feature-icon">
                  <f.icon aria-hidden="true" />
                </span>
                <span>
                  <strong>{f.title}</strong>
                  <em>{f.body}</em>
                </span>
              </li>
            ))}
          </ul>

          <div className="m-auth__trust">
            <span className="m-auth__avatars" aria-hidden="true">
              <i>A</i>
              <i>P</i>
              <i>M</i>
              <i>S</i>
            </span>
            Invite-only access · every change audited
          </div>

          <p className="m-auth__brandfoot">WorkPulse — built on Amazon Web Services</p>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================
 * Field primitives
 * ==========================================================================*/

/** Card heading. `h1` because the form is the page's subject, not the panel. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="m-display">{title}</h1>
      {subtitle ? <p className="m-auth__card-sub">{subtitle}</p> : null}
    </div>
  );
}

/**
 * A labelled field with the full error/hint wiring.
 *
 * - `aria-describedby` (not `aria-errormessage`): the latter is semantically correct but still has
 *   patchy assistive-tech support, while describedby is universal.
 * - `aria-invalid` is **omitted entirely** until validation has run — it should never be present in
 *   the untouched state, and `false` is equivalent to absent anyway.
 * - The error is rendered **above** the input: below it, the mobile keyboard covers it at the exact
 *   moment the field has focus.
 * - The visually-hidden "Error:" prefix gives screen-reader users the same instant signal the red
 *   text gives everyone else.
 */
export function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoComplete,
  inputMode,
  required,
  disabled,
  trailing,
  inputRef,
  ...rest
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  /** Message to show. Presence is what marks the field invalid. */
  error?: string | null;
  hint?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric" | "tel";
  required?: boolean;
  disabled?: boolean;
  /** Trailing control inside the field (the password toggle). */
  trailing?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "value" | "onChange" | "onBlur" | "required" | "disabled">) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="m-afield">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className="m-afield__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {/*
        The message is rendered for assistive tech but not shown.

        The visible copy lives once, in the error summary at the top of the card — repeating it
        beside the field duplicated the same sentence twice on screen, and because it renders above
        the input it also shoved one half of a paired two-up row out of alignment with the other.

        It is NOT simply deleted: the field keeps `aria-invalid` and an `aria-describedby` pointing
        here, so a screen reader still announces the specific problem on focus rather than leaving
        the user to correlate a summary item with a field by name. Sighted users get the red border
        plus the summary; both routes still lead to the same wording.
      */}
      {error ? (
        <p className="m-sr" id={errId}>
          Error: {error}
        </p>
      ) : null}
      <div className="m-afield__wrap">
        <input
          id={id}
          name={id}
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          disabled={disabled}
          aria-describedby={describedBy}
          {...(error ? { "aria-invalid": true as const } : {})}
          className={`m-authinput${trailing ? " m-authinput--withtoggle" : ""}`}
          {...rest}
        />
        {trailing}
      </div>
    </div>
  );
}

/**
 * Password field. Split out because it carries four easy-to-miss requirements:
 * `spellcheck="false"` (browser spellcheckers have been caught shipping field contents to third
 * parties — "spell-jacking"), `autocapitalize="none"`, a real `type="button"` toggle so it cannot
 * submit the form, and a polite live region, because swapping the toggle's label alone is not
 * reliably announced.
 */
export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoComplete,
  disabled,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string | null;
  hint?: string;
  /** `current-password` when signing in, `new-password` when setting one. */
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <AuthField
        id={id}
        label={label}
        type={shown ? "text" : "password"}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        hint={hint}
        autoComplete={autoComplete}
        disabled={disabled}
        inputRef={inputRef}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        trailing={
          <button
            type="button"
            className="m-pwtoggle"
            aria-controls={id}
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => setShown(!shown)}
          >
            {shown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
      />
      <span className="m-sr" aria-live="polite">
        {shown ? "Your password is visible" : "Your password is hidden"}
      </span>
    </>
  );
}

/**
 * The Cognito user pool's actual password policy (`auth_stack.py`), mirrored so the form rejects
 * what the pool would reject rather than letting someone discover it three steps later.
 *
 * ⚠️ These are **not** invented house rules. The pool is configured `min_length: 12`,
 * `require_lowercase`, `require_uppercase`, `require_digits`, `require_symbols: false`. The backend's
 * own `create_org` validator only checks length ≥ 8, so a short lowercase password passes both this
 * app's old check and the server's, and is then refused by Cognito at the final step with a message
 * the user never sees in context. Keep this list and the pool in step; changing the pool needs a
 * deploy, so if it moves, this moves with it.
 */
export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: "len", label: "At least 12 characters", test: (v) => v.length >= 12 },
  { id: "upper", label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", test: (v) => /[a-z]/.test(v) },
  { id: "digit", label: "One number", test: (v) => /\d/.test(v) },
];

export function passwordMeetsPolicy(v: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(v));
}

/**
 * Live requirement checklist.
 *
 * Shown as met/unmet state rather than a coloured strength bar: a five-segment meter that turns
 * green on `Password1!` certifies a crackable password as strong, whereas a checklist tells the user
 * exactly what is still missing. `aria-live="polite"` so the state is announced as it changes, and
 * each row carries a text marker so the signal is never colour alone.
 */
export function AuthPasswordRules({
  value,
  confirm,
  showMatch,
}: {
  value: string;
  confirm?: string;
  showMatch?: boolean;
}) {
  const rows = [
    ...PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(value) })),
    ...(showMatch
      ? [{ id: "match", label: "Passwords match", ok: value.length > 0 && value === confirm }]
      : []),
  ];
  return (
    <div className="m-pwrules" aria-live="polite">
      <p className="m-pwrules__title">Password requirements</p>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className={r.ok ? "is-ok" : undefined}>
            <span aria-hidden="true">{r.ok ? "✓" : "○"}</span>
            <span className="m-sr">{r.ok ? "Met: " : "Not met: "}</span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Step indicator for the inline sign-up flow.
 *
 * `aria-current="step"` marks the active one; the count is also stated in text, because a row of
 * dots communicates nothing to a screen reader on its own.
 */
export function AuthSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="m-steps">
      {/* Bars carry the progress; the label is stated once beneath. Printing all five names
          across a 30rem column truncates them into initials that mean nothing. */}
      <ol aria-hidden="true">
        {steps.map((s, i) => (
          <li key={s} className={i === current ? "is-current" : i < current ? "is-done" : undefined} />
        ))}
      </ol>
      <p className="m-steps__label">
        <span>
          Step {current + 1} of {steps.length}
        </span>
        {steps[current]}
      </p>
    </div>
  );
}

/**
 * Submit-time error summary: rendered, then focused. `role="alert"` plus programmatic focus is
 * belt-and-braces across screen readers. Summary wording must match the field-level wording exactly
 * — differing text gets double-announced as two separate problems.
 */
export function AuthErrorSummary({
  errors,
  summaryRef,
}: {
  /** `[fieldId, message]` — the id makes each entry a jump link to the field. */
  errors: [string, string][];
  summaryRef?: React.Ref<HTMLDivElement>;
}) {
  if (errors.length === 0) return null;

  // A single error needs no heading-plus-list scaffolding — "There is a problem" followed by a
  // one-item list says the same thing twice and costs ~35px of a height-locked card. One error
  // renders as one line; the heading returns only when there is genuinely a list to introduce.
  const one = errors.length === 1;

  return (
    <div
      className={`m-errsummary${one ? " m-errsummary--one" : ""}`}
      role="alert"
      tabIndex={-1}
      ref={summaryRef}
    >
      {one ? (
        <p>
          <span className="m-sr">There is a problem: </span>
          <a href={`#${errors[0][0]}`}>{errors[0][1]}</a>
        </p>
      ) : (
        <>
          <h2>There is a problem</h2>
          <ul>
            {errors.map(([id, msg]) => (
              <li key={id}>
                <a href={`#${id}`}>{msg}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** In-card switch between sign-in and sign-up. */
export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-4 text-center text-sm" style={{ color: "var(--m-muted)" }}>
      {prompt}{" "}
      <Link
        href={href}
        className="font-semibold underline underline-offset-2"
        style={{ color: "var(--m-accent-ink)" }}
      >
        {label}
      </Link>
    </p>
  );
}

/* ---- Icons: inlined so the auth route ships no icon-set weight it doesn't use ---- */
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-[18px]" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-[18px]" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.4 5.4A9.6 9.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.3 4.2M6.2 6.7A17 17 0 002 12s3.6 7 10 7c1.3 0 2.5-.3 3.6-.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
