"use client";

/**
 * Invite acceptance — the other half of the invite flow.
 *
 * Admins could already *send* invites (`POST /v1/employees/invites`), but nothing in the web app
 * could redeem one, so an invited person had no way in. This page is that missing half.
 *
 * The emailed link carries `invite_id` + `tenant_id` + `token`. The OTP is sent **separately** and is
 * typed in here — that split is the point: possession of the link alone doesn't grant access. Five
 * bad OTP attempts lock the invite; it expires after 7 days.
 *
 * Email, role and employee id are fixed by the admin and shown read-only. The invitee only chooses
 * their name, password, and optional contact details.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  acceptInvite,
  lookupInvite,
  type InvitePreview,
} from "@/modules/auth/services/signup.service";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name."),
  otp: z.string().trim().min(4, "Enter the code from your email."),
  password: z.string().min(8, "Use at least 8 characters."),
  job_title: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

/** Copy for every non-usable invite state the server can report. */
const BLOCKED: Record<string, { title: string; body: string }> = {
  expired: {
    title: "This invite has expired",
    body: "Invites are valid for 7 days. Ask an admin in your organization to send a new one.",
  },
  accepted: {
    title: "This invite was already used",
    body: "The account exists — sign in with the email the invite was sent to.",
  },
  locked: {
    title: "This invite is locked",
    body: "Too many incorrect codes were entered. Ask an admin to reissue the invite.",
  },
};

export function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();

  const inviteId = params.get("invite") ?? "";
  const tenantId = params.get("tenant") ?? "";
  const token = params.get("token") ?? "";
  const linkComplete = Boolean(inviteId && tenantId && token);

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(linkComplete);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", otp: "", password: "" },
  });

  const load = useCallback(async () => {
    if (!linkComplete) return;
    setLoading(true);
    setLoadError(null);
    try {
      setPreview(await lookupInvite({ inviteId, tenantId, token }));
    } catch (e) {
      setLoadError(
        e instanceof ApiError && e.status === 404
          ? "We couldn't find that invite. The link may be incomplete — try copying it from your email again."
          : e instanceof ApiError
            ? e.message
            : "Couldn't load this invite. Check your connection and retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [inviteId, tenantId, token, linkComplete]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (values: FormValues) => {
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
      toast.success("Welcome to WorkPulse", {
        description: `You've joined as ${result.emp_id}. Sign in to get started.`,
      });
      router.push(`/login?email=${encodeURIComponent(result.email)}`);
    } catch (e) {
      // A wrong OTP is the common case and burns one of five attempts — say so plainly.
      if (e instanceof ApiError && (e.status === 400 || e.status === 403)) {
        toast.error("That code didn't match", {
          description: "Check the code in your invite email and try again.",
        });
        void load(); // refresh status in case that attempt locked the invite
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't accept the invite.");
      }
    }
  };

  if (!linkComplete) {
    return (
      <Notice
        title="This invite link is incomplete"
        body="Open the link straight from your invite email — it carries the details needed to identify the invite."
      />
    );
  }

  if (loading) return <Loader label="Checking your invite…" />;

  if (loadError) {
    return (
      <Notice title="Couldn't load this invite" body={loadError}>
        <Button variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </Notice>
    );
  }

  if (preview && preview.status !== "pending") {
    const copy = BLOCKED[preview.status] ?? {
      title: "This invite can't be used",
      body: "Ask an admin in your organization to send a new one.",
    };
    return (
      <Notice title={copy.title} body={copy.body}>
        <Button render={<Link href="/login" />} nativeButton={false}>
          Go to sign in
        </Button>
      </Notice>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          Join {preview?.org_name}
        </CardTitle>
        <CardDescription>
          You&apos;ve been invited as {preview?.role_name}. Set a password to finish.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {/* Fixed by the admin at invite time — shown, never editable. */}
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Invited email</p>
              <p className="truncate text-sm font-medium">{preview?.email}</p>
            </div>
            <Badge className="shrink-0">{preview?.role_name}</Badge>
          </div>

          <Field label="Full name" error={errors.full_name?.message}>
            <Input placeholder="Alex Morgan" {...register("full_name")} />
          </Field>

          <Field
            label="Invite code"
            error={errors.otp?.message}
            hint="From the invite email — sent separately from this link."
          >
            <Input inputMode="numeric" autoComplete="one-time-code" {...register("otp")} />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="pr-9"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title" optional>
              <Input placeholder="Product Designer" {...register("job_title")} />
            </Field>
            <Field label="Phone" optional>
              <Input type="tel" {...register("phone")} />
            </Field>
          </div>
          <Field label="Location" optional>
            <Input placeholder="City, country" {...register("location")} />
          </Field>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Joining…
              </>
            ) : (
              "Join organization"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function Field({
  label,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {optional && <span className="ml-1.5 text-xs text-muted-foreground">optional</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Notice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-heading text-xl">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {children ? <CardFooter>{children}</CardFooter> : null}
    </Card>
  );
}
