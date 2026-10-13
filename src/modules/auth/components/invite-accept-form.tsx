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
} from "./auth-frame";
import { AuthShell } from "./auth-shell";
import { landAfterSignIn, useAuthStore } from "@/stores/auth.store";
import {
  ApiError,
  acceptInvite,
  lookupInvite,
  type InvitePreview,
} from "@/lib/api";

const schema = z
  .object({
    full_name: z.string().trim().min(1, "Your name is required."),
    otp: z.string().trim().min(1, "Enter the code from your invite email."),
    password: z.string().superRefine((val, ctx) => {
      const m = validatePassword(val);
      if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
    }),
    confirm: z.string(),
    // **Required, where they used to be optional.** The profile card shows contact number, date
    // of birth, location and work mode; a joiner told these were optional supplies none of them,
    // and nobody goes back to Settings to finish a record they were never asked to complete. This
    // is the one moment the answer costs a few seconds.
    //
    // The phone rule counts DIGITS: `PhoneInput` emits `+<dial><national>`, so picking a country
    // and typing nothing leaves a bare `+91` — non-empty, and not a phone number.
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/[^\d]/g, "").length >= 6, "Enter your contact number"),
    location: z.string().trim().min(1, "Enter your location"),
    dateOfBirth: z.string().trim().min(1, "Enter your date of birth"),
    workMode: z.enum(["on-site", "hybrid", "remote"], {
      message: "Choose how you work",
    }),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

/** Read-only banner explaining a non-pending link, with a route back to sign-in where it helps. */
function LinkNotice({
  title,
  description,
  showSignIn,
}: {
  title: string;
  description: string;
  showSignIn?: boolean;
}) {
  return (
    <>
      <AuthHeading title={title} subtitle={description} />
      {showSignIn ? (
        <Link href="/login" className="m-btn m-btn-primary mt-4 w-full">
          Go to sign in
        </Link>
      ) : null}
    </>
  );
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
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
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
    },
  });

  useEffect(() => {
    if (!hasLink) {
      setLoading(false);
      return;
    }
    let live = true;
    (async () => {
      try {
        const p = await lookupInvite({ tenantId, inviteId, token });
        if (live) setPreview(p);
      } catch (err) {
        // A missing invite and a bad token both return 404 by design — one message covers both.
        if (live)
          setLinkError(
            err instanceof ApiError && err.status !== 404
              ? "We couldn't load this invite. Try again shortly."
              : "This invite link is invalid or has been revoked.",
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [hasLink, tenantId, inviteId, token]);

  const onSubmit = async (values: FormValues) => {
    if (!preview) return;
    setSubmitting(true);
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
      const { title, description } = describeAcceptError(err);
      toast.error(title, { description });
      setSubmitting(false);
    }
  };

  if (!hasLink) {
    return (
      <AuthShell>
        <LinkNotice
          title="Incomplete invite link"
          description="This link is missing information. Open the most recent invite email, or ask an admin to resend it."
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
        <LinkNotice title="Invite unavailable" description={linkError} />
      </AuthShell>
    );
  }

  if (preview && preview.status !== "pending") {
    return (
      <AuthShell>
        <LinkNotice {...noticeForStatus(preview.status)} />
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
      // The four profile fields are required too. Left out of this list, a missing one failed
      // validation with nothing on screen: "Create account" just did nothing (WP-030).
      ["iv-phone", errors.phone?.message],
      ["iv-location", errors.location?.message],
      ["iv-dob", errors.dateOfBirth?.message],
      ["iv-workmode", errors.workMode?.message],
    ] as [string, string | undefined][]
  ).filter((e): e is [string, string] => Boolean(e[1]));

  return (
    <AuthShell>
      {/* The org, not "WorkPulse": the invitee is joining their employer's workspace, and naming
          the product here made a tenant-scoped invite read like a platform-wide signup. */}
      <AuthHeading
        title={`Join ${preview?.org_name ?? "your organization"}`}
        subtitle={`You've been invited to ${preview?.org_name ?? "this workspace"} as ${preview?.role_name}. Set up your account for ${preview?.email}.`}
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

        <div className="m-arow">
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <AuthField
                id="iv-phone"
                label="Contact number"
                error={errors.phone?.message}
                value={field.value ?? ""}
                onChange={field.onChange}
                control={
                  <PhoneInput
                    id="iv-phone"
                    value={field.value ?? ""}
                    onChange={field.onChange}
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
                error={errors.location?.message}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </div>

        <div className="m-arow">
          <Controller
            control={control}
            name="dateOfBirth"
            render={({ field }) => (
              <AuthField
                id="iv-dob"
                label="Date of birth"
                error={errors.dateOfBirth?.message}
                value={field.value ?? ""}
                onChange={field.onChange}
                control={
                  <DatePicker
                    id="iv-dob"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    max={todayIso()}
                    min="1900-01-01"
                    className="m-authinput h-11 w-full"
                  />
                }
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
                error={errors.workMode?.message}
                value={field.value ?? ""}
                onChange={field.onChange}
                control={
                  <select
                    id="iv-workmode"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
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
        </div>

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

function noticeForStatus(status: string): {
  title: string;
  description: string;
  showSignIn?: boolean;
} {
  switch (status) {
    case "expired":
      return {
        title: "This invite has expired",
        description:
          "Invites are valid for 7 days. Ask an admin to send you a new one.",
      };
    case "accepted":
      return {
        title: "This invite was already used",
        description: "Your account already exists — sign in to continue.",
        showSignIn: true,
      };
    case "locked":
      return {
        title: "This invite is locked",
        description:
          "Too many incorrect codes were entered. Ask an admin to resend the invite.",
      };
    default:
      return {
        title: "Invite unavailable",
        description: "This invite can no longer be used. Ask an admin to resend it.",
      };
  }
}

function describeAcceptError(err: unknown): {
  title: string;
  description: string;
} {
  if (err instanceof ApiError) {
    if (err.status === 401)
      return {
        title: "That code didn't match",
        description: "Check the invite code from your email and try again.",
      };
    switch (err.code) {
      case "invite_locked":
        return {
          title: "Invite locked",
          description:
            "Too many incorrect codes. Ask an admin to resend your invite.",
        };
      case "invite_expired":
        return {
          title: "Invite expired",
          description: "This invite is past its 7-day window. Ask for a new one.",
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
      return { title: "Check your details", description: err.message };
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
