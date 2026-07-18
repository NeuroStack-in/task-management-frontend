"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./auth-shell";
import { useAuthStore } from "@/stores/auth.store";
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
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
    job_title: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    location: z.string().trim().optional(),
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {showSignIn ? (
        <CardFooter>
          <Button render={<Link href="/login" />} nativeButton={false}>
            Go to sign in
          </Button>
        </CardFooter>
      ) : null}
    </Card>
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      otp: "",
      password: "",
      confirm: "",
      job_title: "",
      phone: "",
      location: "",
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
        job_title: values.job_title?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        location: values.location?.trim() || undefined,
      });

      // Account exists now. Try to sign them straight in; if that hiccups, send them to /login —
      // the account is real either way, so never present acceptance as failed here.
      try {
        await login(result.email, values.password);
        toast.success("Welcome to WorkPulse", {
          description: "Your account is ready.",
        });
        router.replace("/dashboard");
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
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking your invite…
          </CardContent>
        </Card>
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

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Join {preview?.org_name ?? "your organization"}
          </CardTitle>
          <CardDescription>
            You&apos;ve been invited to WorkPulse as{" "}
            <span className="font-medium text-foreground">
              {preview?.role_name}
            </span>
            . Set up your account for{" "}
            <span className="font-medium text-foreground">{preview?.email}</span>
            .
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <Field
              id="iv-name"
              label="Full name"
              error={errors.full_name?.message}
            >
              <Input
                id="iv-name"
                autoComplete="name"
                {...register("full_name")}
              />
            </Field>

            <Field
              id="iv-otp"
              label="Invite code"
              hint="The code from your invite email."
              error={errors.otp?.message}
            >
              <Input id="iv-otp" inputMode="numeric" {...register("otp")} />
            </Field>

            <Field
              id="iv-password"
              label="Password"
              error={errors.password?.message}
            >
              <Input
                id="iv-password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
            </Field>

            <Field
              id="iv-confirm"
              label="Confirm password"
              error={errors.confirm?.message}
            >
              <Input
                id="iv-confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
              />
            </Field>

            <Field id="iv-title" label="Job title (optional)">
              <Input id="iv-title" {...register("job_title")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field id="iv-phone" label="Phone (optional)">
                <Input
                  id="iv-phone"
                  autoComplete="tel"
                  {...register("phone")}
                />
              </Field>
              <Field id="iv-location" label="Location (optional)">
                <Input id="iv-location" {...register("location")} />
              </Field>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating your account…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  );
}

/** Label + optional hint + field + error, matching the sibling auth forms. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
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
    }
  }
  return {
    title: "Couldn't create your account",
    description: "Something went wrong. Please try again.",
  };
}
