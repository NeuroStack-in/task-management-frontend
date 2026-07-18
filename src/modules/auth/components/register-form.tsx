"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api";
import { createOrg, slugify } from "@/modules/auth/services/signup.service";
import { cn } from "@/lib/utils";
import { SsoButtons } from "./sso-buttons";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid work email."),
  company: z.string().trim().min(2, "Enter your company name."),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.literal(true, {
    errorMap: () => ({ message: "Please accept the terms to continue." }),
  }),
});

type FormValues = z.infer<typeof schema>;

const STRENGTH = ["Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = [
  "bg-destructive",
  "bg-warning",
  "bg-chart-2",
  "bg-success",
];

function scorePassword(pw: string): number {
  if (!pw) return 0;
  return [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ].filter(Boolean).length;
}

export function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", company: "", password: "" },
  });

  const password = watch("password") ?? "";
  const score = scorePassword(password);
  const companySlug = slugify(watch("company") ?? "");

  // `POST /v1/org/create` — one public call that creates the tenant, the Cognito owner, the seeded
  // system roles and the plan entitlements. There is no separate "create account" step: the owner
  // *is* the org. On success we send them to sign in, because the call issues no session.
  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await createOrg({
        org: {
          name: values.company.trim(),
          slug: slugify(values.company),
          // The browser's own zone — the org's default until an admin changes it in settings.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        },
        owner: {
          email: values.email.trim().toLowerCase(),
          password: values.password,
          full_name: values.name.trim(),
        },
        // Every org starts free; upgrading is a billing action, not a signup choice.
        plan: "free",
      });
      toast.success("Workspace created", {
        description: "Sign in with the email and password you just chose.",
      });
      router.push(`/login?email=${encodeURIComponent(values.email.trim().toLowerCase())}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("That workspace name is taken", {
          description: "Try a different organization name.",
        });
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't create your workspace. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">
          Create your account
        </CardTitle>
        <CardDescription>
          Set up your WorkPulse workspace in minutes.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <SsoButtons verb="Sign up" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Alex Morgan" {...register("name")} />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Organization</Label>
              <Input id="company" placeholder="Acme Inc." {...register("company")} />
              {errors.company ? (
                <p className="text-xs text-destructive">
                  {errors.company.message}
                </p>
              ) : companySlug ? (
                <p className="text-xs text-muted-foreground">
                  Workspace: <span className="font-mono">{companySlug}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">Work email</Label>
            <Input
              id="reg-email"
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
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="pr-9"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {password ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors",
                        i < score ? STRENGTH_COLOR[score - 1] : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <span className="w-10 text-right text-[11px] text-muted-foreground">
                  {STRENGTH[Math.max(0, score - 1)]}
                </span>
              </div>
            ) : null}
            {errors.password ? (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="terms"
                render={({ field }) => (
                  <Checkbox
                    id="terms"
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="terms" className="text-sm font-normal">
                I agree to the Terms of Service and Privacy Policy.
              </Label>
            </div>
            {errors.terms ? (
              <p className="text-xs text-destructive">{errors.terms.message}</p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating account…
              </>
            ) : (
              "Create account"
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
