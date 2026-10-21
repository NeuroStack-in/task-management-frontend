"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { todayIso } from "@/lib/format";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { validatePassword } from "@/lib/password";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AuthErrorSummary,
  AuthField,
  AuthHeading,
  AuthPasswordField,
  AuthPasswordRules,
} from "./auth-frame";
import { AuthShell as BaseAuthShell } from "./auth-shell";
import { landAfterSignIn, useAuthStore } from "@/stores/auth.store";
import { legalHref } from "@/modules/legal/documents";
import {
  ApiError,
  acceptInvite,
  lookupInvite,
  type InvitePreview,
} from "@/lib/api";

const TERMS_MESSAGE = "Agree to the Terms of Service and Privacy Policy to continue";

/**
 * The brand panel for someone joining for the first time. The recovery-flow default ("Back to work
 * in a moment — we'll get you signed in again") greeted a brand-new invitee (UX audit ONB-16).
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <BaseAuthShell
      headline="Join your team"
      headlineAccent="on WorkPulse"
      copy="Set up your account once. You'll use the same email and password on the web and in the WorkPulse desktop app."
    >
      {children}
    </BaseAuthShell>
  );
}

const schema = z
  .object({
    full_name: z.string().trim().min(1, "Your name is required."),
    otp: z.string().trim().min(1, "Enter the code from your invite email."),
    password: z.string().superRefine((val, ctx) => {
      const m = validatePassword(val);
      if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
    }),
    confirm: z.string(),
    // Contact number, location and work mode are required: the profile card shows them, and a
    // joiner told they were optional supplied none of them. Each now says why it is asked
    // (UX audit 2026-10-16, ONB-08).
    //
    // The phone rule counts DIGITS: `PhoneInput` emits `+<dial><national>`, so picking a country
    // and typing nothing leaves a bare `+91` — non-empty, and not a phone number.
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/[^\d]/g, "").length >= 6, "Enter your contact number"),
    location: z.string().trim().min(1, "Enter your location"),
    // **Optional** (ONB-08), as it already is in the first-run profile gate (SHELL-02): it is
    // sensitive, nothing in the product needs it, and the server never required it.
    dateOfBirth: z.string().trim(),
    workMode: z.enum(["on-site", "hybrid", "remote"], {
      message: "Choose how you work",
    }),
    // Sign-up has asked for this since WP-115; an invitee creates an account too (ONB-08).
    terms: z.boolean().refine((v) => v, TERMS_MESSAGE),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * A link that can't be used, and every way on from it (UX audit 2026-10-16, ONB-05).
 *
 * Four of these states used to be text and nothing else — no button, no way home, no one to ask —
 * and only "already used" offered sign-in. Every state now offers **Go to sign in** (someone who
 * already has an account is the commonest visitor to a dead invite) and says who can send a new
 * one. The invite preview carries no inviter name, so that is "the person who invited you" rather
 * than a name; the org is named when the link got far enough to know it.
 */
function LinkNotice({
  title,
  description,
  help,
  helpTitle = "Need a new invite?",
  retry,
  primary = "sign-in",
}: {
  title: string;
  description: string;
  /** Who can fix it and how. Omitted where the visitor needs no new invite. */
  help?: string;
  helpTitle?: string;
  /** A transient failure: offer the same link again, before anything else. */
  retry?: () => void;
  primary?: "sign-in" | "retry";
}) {
  return (
    <>
      <AuthHeading title={title} subtitle={description} />
      <div className="mt-4 flex flex-col gap-2">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className={`m-btn w-full ${primary === "retry" ? "m-btn-primary" : "m-btn-ghost"}`}
          >
            Try again
          </button>
        ) : null}
        <Link
          href="/login"
          className={`m-btn w-full ${primary === "sign-in" ? "m-btn-primary" : "m-btn-ghost"}`}
        >
          Go to sign in
        </Link>
      </div>
      {help ? (
        <div
          className="mt-5 rounded-lg border p-3.5 text-sm"
          style={{ borderColor: "var(--m-border)", background: "var(--m-surface-2)" }}
        >
          <p className="font-semibold" style={{ color: "var(--m-text)" }}>
            {helpTitle}
          </p>
          <p className="mt-1" style={{ color: "var(--m-muted)" }}>
            {help}
          </p>
        </div>
      ) : null}
      <p className="mt-4 text-center text-sm">
        <Link
          href="/"
          className="font-medium underline underline-offset-2"
          style={{ color: "var(--m-accent-ink)" }}
        >
          Go to the WorkPulse home page
        </Link>
      </p>
    </>
  );
}

/**
 * "Ask Priya (who invited you to Acme) to …" — the inviter's name and the org only when the page
 * knows them (`inviter_name` on the preview, UX audit ONB-05); otherwise "the person who invited you".
 */
function askInviter(org: string | undefined, what: string, inviter?: string): string {
  const who = inviter?.trim()
    ? `${inviter.trim()}${org ? ` (who invited you to ${org})` : ""}`
    : `the person who invited you${org ? ` to ${org}` : ""}`;
  return `Ask ${who} to ${what}. A new invite email comes with a fresh link and code.`;
}

export function InviteAcceptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const tenantId = params.get("tenant_id") ?? "";
  const inviteId = params.get("invite_id") ?? "";
  const token = params.get("token") ?? "";
  const hasLink = Boolean(tenantId && inviteId && token);

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [linkError, setLinkError] = useState<{ message: string; transient: boolean } | null>(
    null,
  );
  /** Bumped by "Try again" to re-run the lookup after a transient failure. */
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  /**
   * The server's refusal, kept in the error summary until the form changes (UX audit ONB-10). It was
   * a toast: gone in four seconds, never focused, so a wrong invite code left a screen-reader user
   * with a form that "did nothing".
   */
  const [serverError, setServerError] = useState<[string, string] | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      otp: "",
      password: "",
      confirm: "",
      phone: "",
      location: "",
      dateOfBirth: "",
      workMode: undefined,
      terms: false,
    },
  });

  // Any edit clears the server's refusal — it described the values that were sent, not these.
  useEffect(() => {
    const sub = watch(() => setServerError(null));
    return () => sub.unsubscribe();
  }, [watch]);

  // The live password checklist reads the fields as they're typed (ONB-10).
  const password = watch("password");
  const confirm = watch("confirm");

  useEffect(() => {
    if (!hasLink) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setLinkError(null);
    (async () => {
      try {
        const p = await lookupInvite({ tenantId, inviteId, token });
        if (live) setPreview(p);
      } catch (err) {
        // A missing invite and a bad token both return 404 by design — one message covers both.
        if (live)
          setLinkError(
            err instanceof ApiError && err.status !== 404
              ? { message: "We couldn't load this invite. Try again shortly.", transient: true }
              : { message: "This invite link is invalid or has been revoked.", transient: false },
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [hasLink, tenantId, inviteId, token, attempt]);

  const onSubmit = async (values: FormValues) => {
    if (!preview) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await acceptInvite({
        tenant_id: tenantId,
        invite_id: inviteId,
        token,
        otp: values.otp.trim(),
        full_name: values.full_name.trim(),
        password: values.password,
        // No job_title: it's an org fact the admin fixed at invite time (required since
        // 2026-07-22) — the server ignores an invitee-typed title, so the form doesn't ask.
        phone: values.phone?.trim() || undefined,
        location: values.location?.trim() || undefined,
        date_of_birth: values.dateOfBirth || undefined,
        work_mode: values.workMode,
        // Recorded on their user row as `terms_accepted_at` (ONB-08); the form won't submit without it.
        terms_accepted: values.terms,
      });

      // Account exists now. Try to sign them straight in; if that hiccups, send them to /login —
      // the account is real either way, so never present acceptance as failed here.
      try {
        await login(result.email, values.password);
        toast.success("Welcome to WorkPulse", {
          description: "Your account is ready.",
        });
        // This page has no signed-in guard, so the link may have been opened in someone else's
        // session — then a full page load, so none of their state rides along (WP-387).
        landAfterSignIn(router, "/dashboard");
      } catch {
        toast.success("Account created", {
          description: "Sign in with your new password to continue.",
        });
        router.replace("/login");
      }
    } catch (err) {
      const { title, description, field } = describeAcceptError(err);
      setServerError([field ?? "", `${title}. ${description}`]);
      setSubmitting(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  };

  if (!hasLink) {
    return (
      <AuthShell>
        <LinkNotice
          title="Incomplete invite link"
          description="This link is missing part of its address — it can get cut off when it's copied. Open it straight from the most recent invite email."
          help={askInviter(undefined, "send it again")}
        />
      </AuthShell>
    );
  }

  if (loading) {
    return (
      <AuthShell>
        <p
          className="flex items-center justify-center gap-2 py-10 text-sm"
          style={{ color: "var(--m-muted)" }}
        >
          <Loader2 className="m-spin size-4" />
          Checking your invite…
        </p>
      </AuthShell>
    );
  }

  if (linkError) {
    return (
      <AuthShell>
        <LinkNotice
          title="Invite unavailable"
          description={linkError.message}
          {...(linkError.transient
            ? { retry: () => setAttempt((n) => n + 1), primary: "retry" as const }
            : { help: askInviter(undefined, "send you a new invite") })}
        />
      </AuthShell>
    );
  }

  if (preview && preview.status !== "pending") {
    return (
      <AuthShell>
        <LinkNotice
          {...noticeForStatus(preview.status, preview.org_name, preview.inviter_name)}
        />
      </AuthShell>
    );
  }

  // The visible copy lives once, in the summary at the top of the card — the fields carry the same
  // wording to assistive tech only. Same contract as login/signup (see AuthField).
  const summary = (
    [
      ["iv-name", errors.full_name?.message],
      ["iv-otp", errors.otp?.message],
      ["iv-password", errors.password?.message],
      ["iv-confirm", errors.confirm?.message],
      // The required profile fields too. Left out of this list, a missing one failed validation
      // with nothing on screen: "Create account" just did nothing (WP-030).
      ["iv-phone", errors.phone?.message],
      ["iv-location", errors.location?.message],
      ["iv-dob", errors.dateOfBirth?.message],
      ["iv-workmode", errors.workMode?.message],
      ["iv-terms", errors.terms?.message],
      ...(serverError ? [serverError] : []),
    ] as [string, string | undefined][]
  ).filter((e): e is [string, string] => Boolean(e[1]));

  const org = preview?.org_name ?? "your organization";

  return (
    <AuthShell>
      {/* The org, not "WorkPulse": the invitee is joining their employer's workspace, and naming
          the product here made a tenant-scoped invite read like a platform-wide signup. */}
      <AuthHeading
        title={`Join ${preview?.org_name ?? "your organization"}`}
        subtitle={`You've been invited to ${preview?.org_name ?? "this organization"} as ${preview?.role_name}. Set up your account for ${preview?.email}.`}
      />

      <form
        onSubmit={handleSubmit(onSubmit, () =>
          requestAnimationFrame(() => summaryRef.current?.focus()),
        )}
        noValidate
      >
        <AuthErrorSummary errors={summary} summaryRef={summaryRef} />

        <Controller
          control={control}
          name="full_name"
          render={({ field }) => (
            <AuthField
              id="iv-name"
              label="Full name"
              autoComplete="name"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.full_name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="otp"
          render={({ field }) => (
            <AuthField
              id="iv-otp"
              label="Invite code"
              hint="The code from your invite email."
              inputMode="numeric"
              required
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.otp?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <AuthPasswordField
              id="iv-password"
              label="Password"
              autoComplete="new-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <AuthPasswordField
              id="iv-confirm"
              label="Confirm password"
              autoComplete="new-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.confirm?.message}
            />
          )}
        />

        {/* The same live checklist sign-up shows: invitees saw the policy only after a failed
            submit (ONB-10). */}
        <AuthPasswordRules value={password ?? ""} confirm={confirm ?? ""} showMatch />

        {/* ── Your employee record ──
            Each personal field says why it is asked (ONB-08). One per row, so each purpose line
            sits with its own field instead of pushing a paired field out of line. The wording
            matches the first-run profile gate, which asks the same things of older accounts. */}
        <p className="mt-5 text-sm font-semibold" style={{ color: "var(--m-text)" }}>
          Your employee record
        </p>
        <p className="m-anote mt-1 mb-3">
          These go on your employee record at {org}, which its admins and HR can see. WorkPulse
          uses them for nothing else.
        </p>

        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <AuthField
              id="iv-phone"
              label="Contact number"
              hint="So your organization can reach you about work."
              error={errors.phone?.message}
              value={field.value ?? ""}
              onChange={field.onChange}
              control={
                <PhoneInput
                  id="iv-phone"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  aria-describedby="iv-phone-hint"
                  className="w-full"
                  triggerClassName="m-authinput h-11 w-auto rounded-r-none border-r-0"
                  inputClassName="m-authinput h-11 rounded-l-none"
                />
              }
            />
          )}
        />
        <Controller
          control={control}
          name="location"
          render={({ field }) => (
            <AuthField
              id="iv-location"
              label="Location"
              hint="The city you work from, shown on your profile."
              error={errors.location?.message}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
        <Controller
          control={control}
          name="workMode"
          render={({ field }) => (
            <AuthField
              id="iv-workmode"
              label="Work mode"
              hint="On-site, hybrid or remote — for your team's planning."
              error={errors.workMode?.message}
              value={field.value ?? ""}
              onChange={field.onChange}
              control={
                <select
                  id="iv-workmode"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-describedby="iv-workmode-hint"
                  className="m-authinput"
                >
                  <option value="">Select…</option>
                  {/* Exactly `shared::profile::WORK_MODES`. */}
                  <option value="on-site">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              }
            />
          )}
        />
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field }) => (
            <AuthField
              id="iv-dob"
              label="Date of birth (optional)"
              hint="For HR records only. Leave it blank if you prefer."
              error={errors.dateOfBirth?.message}
              value={field.value ?? ""}
              onChange={field.onChange}
              control={
                <DatePicker
                  id="iv-dob"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  aria-describedby="iv-dob-hint"
                  max={todayIso()}
                  min="1900-01-01"
                  className="m-authinput h-11 w-full"
                />
              }
            />
          )}
        />

        <MonitoringNotice org={org} />

        {/* Mirrors sign-up's agreement (WP-115): the links sit inside the label, so clicking one
            opens the document without toggling the box, and they open in a new tab so nothing typed
            here is lost. Required to continue; not yet recorded by the server (no field on
            `POST /v1/invites/accept`). */}
        <Controller
          control={control}
          name="terms"
          render={({ field }) => (
            <label className="m-check mt-3">
              <input
                type="checkbox"
                id="iv-terms"
                name="iv-terms"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                {...(errors.terms ? { "aria-invalid": true as const } : {})}
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
                .<span className="m-check__note">Both open in a new tab.</span>
              </span>
            </label>
          )}
        />

        <button
          type="submit"
          disabled={submitting}
          className="m-btn m-btn-primary mt-4 w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="m-spin size-4" /> Creating your account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </AuthShell>
  );
}

/**
 * What the organization can record, told before the account exists (UX audit ONB-08, EMP-01).
 *
 * The org's own policy can't be shown here: `GET /v1/agent/config`, which the Download page's
 * disclosure reads, needs a signed-in member, and the invite preview carries no policy. So this
 * names what the agents *can* record — worded like `modules/legal/facts.tsx`, which cites the code
 * for each claim — and points to the Download page, which lists exactly what this org has on.
 */
function MonitoringNotice({ org }: { org: string }) {
  return (
    <section
      aria-labelledby="iv-monitoring-title"
      className="mt-5 rounded-lg border p-3.5 text-sm"
      style={{ borderColor: "var(--m-border)", background: "var(--m-surface-2)" }}
    >
      <h2 id="iv-monitoring-title" className="font-semibold" style={{ color: "var(--m-text)" }}>
        What {org} can record
      </h2>
      <div className="mt-1 space-y-1.5" style={{ color: "var(--m-muted)" }}>
        <p>
          {org} uses WorkPulse to track working time. While tracking is running, and depending on
          its settings, WorkPulse can also record:
        </p>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>screenshots of your screen, at an interval {org} sets;</li>
          <li>
            the apps you use and their window titles, active and idle time, and counts of keyboard
            and mouse activity — never what you type;
          </li>
          <li>your device&apos;s approximate location, if the device allows it.</li>
        </ul>
        <p>
          Administrators with permission can see this. Once you&apos;re signed in, the Download page
          lists exactly what {org} has turned on. More in the{" "}
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
        </p>
      </div>
    </section>
  );
}

function noticeForStatus(
  status: string,
  org: string | undefined,
  inviter?: string,
): {
  title: string;
  description: string;
  help?: string;
  helpTitle?: string;
} {
  switch (status) {
    case "expired":
      return {
        title: "This invite has expired",
        description: "Invites are valid for 7 days, and this one has run out.",
        helpTitle: "Request a new invite",
        help: askInviter(org, "send you a new one", inviter),
      };
    case "accepted":
      return {
        title: "This invite was already used",
        description:
          "Your account already exists — sign in to continue. If you've forgotten your password, the sign-in page can reset it.",
      };
    case "locked":
      return {
        title: "This invite is locked",
        description: "Too many incorrect codes were entered, so this invite can't be used now.",
        helpTitle: "Request a new invite",
        help: askInviter(org, "resend it", inviter),
      };
    default:
      return {
        title: "Invite unavailable",
        description: "This invite can no longer be used.",
        help: askInviter(org, "send you a new invite", inviter),
      };
  }
}

function describeAcceptError(err: unknown): {
  title: string;
  description: string;
  /** The field that can fix it, for the error summary's link; absent = the whole form. */
  field?: string;
} {
  if (err instanceof ApiError) {
    if (err.status === 401)
      return {
        title: "That code didn't match",
        description: "Check the invite code from your email and try again.",
        field: "iv-otp",
      };
    switch (err.code) {
      case "invite_locked":
        return {
          title: "Invite locked",
          description:
            "Too many incorrect codes. Ask the person who invited you to resend your invite.",
        };
      case "invite_expired":
        return {
          title: "Invite expired",
          description:
            "This invite is past its 7-day window. Ask the person who invited you for a new one.",
        };
      case "invite_not_pending":
        return {
          title: "Invite already used",
          description: "This account already exists — try signing in instead.",
        };
      // The three refusals below come from a WorkPulse login that already exists for this address,
      // which the server will not take over (QA audit 2026-10-08, BEPM-01).
      case "already_member":
        return {
          title: "You're already a member",
          description: "This email already belongs to someone in this organization. Sign in instead.",
        };
      case "email_in_other_org":
        return {
          title: "This email belongs to another organization",
          description:
            "A WorkPulse account can belong to only one organization. Ask your admin to invite a different email address.",
        };
      case "seat_limit_reached":
        return {
          title: "This organization is out of seats",
          description:
            "Its plan has no seat left for you yet. Ask your admin to free a seat or upgrade the plan, then try again.",
        };
      case "existing_login_needs_emailed_invite":
        return {
          title: "Ask for an emailed invite",
          description:
            "This email already has a WorkPulse sign-in. Ask your admin to resend the invite by email, then use the code from that email.",
        };
      // Two refusals that retrying can never get past, which used to read "Something went wrong.
      // Please try again." (QA audit 2026-10-08, WP-125).
      case "promotion_not_supported":
        return {
          title: "This email can't get a sign-in yet",
          description:
            "Your organization already records this address as an employee without a sign-in, and that record can't be turned into an account yet. Ask your admin to invite a different email address.",
        };
      case "role_not_grantable":
        return {
          title: "This invite needs to be sent again",
          description:
            "It offers a role the person who invited you can no longer grant. Ask an admin to send you a new invite.",
        };
      case "email_taken":
        return {
          title: "This email already has an account",
          description: "Try signing in instead.",
        };
    }
    // A rejected detail ("Date of birth …", the password policy). `apiFetch` has already made the
    // server's words display-ready, and they name the one thing to fix.
    if (err.status === 400)
      return {
        title: "Check your details",
        description: err.message,
        field: /password/i.test(err.message)
          ? "iv-password"
          : /birth/i.test(err.message)
            ? "iv-dob"
            : undefined,
      };
    if (err.status === 404)
      return {
        title: "Invite unavailable",
        description: "This invite link is invalid or has been revoked. Ask an admin to resend it.",
      };
    // A server fault can land after the account was already created, and a blind retry then reads
    // "Invite already used". Point at the way to find out instead.
    if (err.status >= 500)
      return {
        title: "Couldn't finish creating your account",
        description:
          "Your account may have been created anyway. Try signing in with the password you just chose before submitting again.",
      };
    if (err.status === 0)
      return { title: "Couldn't create your account", description: err.message };
  }
  return {
    title: "Couldn't create your account",
    description: "Something went wrong. Please try again.",
  };
}
