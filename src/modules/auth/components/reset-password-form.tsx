"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { validatePassword } from "@/lib/password";
import { useRouter, useSearchParams } from "next/navigation";
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
import { PasswordInput } from "@/components/shared/password-input";
import { Label } from "@/components/ui/label";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/modules/auth/services/auth.service";

const schema = z
  .object({
    email: z.string().email("Enter a valid email address."),
    code: z.string().trim().min(1, "Enter the code from your email."),
    password: z.string().superRefine((val, ctx) => {
      const m = validatePassword(val);
      if (m) ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
    }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

/**
 * Step 2 of the real Cognito reset flow: enter the emailed code and a new password
 * (`confirmPassword`). The email arrives as a query param from the forgot-password step but stays
 * editable so a direct visit (or a typo) still works. "Resend code" re-triggers `forgotPassword`.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillEmail = params.get("email") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: prefillEmail, code: "", password: "", confirm: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await confirmPasswordReset(values.email, values.code, values.password);
      toast.success("Password updated", {
        description: "You can now sign in with your new password.",
      });
      router.push("/login");
    } catch (err) {
      toast.error("Couldn't reset your password", {
        description: err instanceof Error ? err.message : undefined,
      });
      setSubmitting(false);
    }
  };

  const resend = async () => {
    const email = getValues("email").trim();
    if (!email) {
      toast.error("Enter your email first");
      return;
    }
    setResending(true);
    try {
      await requestPasswordReset(email);
      toast.success("Code sent", { description: "Check your email for a new code." });
    } catch (err) {
      toast.error("Couldn't send a new code", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>
          Enter the code we emailed you and choose a strong password you don&apos;t
          use elsewhere.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-email">Email</Label>
            <Input
              id="rp-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="rp-code">Verification code</Label>
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
            <Input
              id="rp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              {...register("code")}
            />
            {errors.code ? (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <PasswordInput
              id="rp-password"
              autoComplete="new-password"
              placeholder="At least 12 characters"
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <PasswordInput
              id="rp-confirm"
              autoComplete="new-password"
              placeholder="Re-enter password"
              {...register("confirm")}
            />
            {errors.confirm ? (
              <p className="text-xs text-destructive">
                {errors.confirm.message}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Updating…
              </>
            ) : (
              "Update password"
            )}
          </Button>
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
