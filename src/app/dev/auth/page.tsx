import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowUpRight } from "lucide-react";
import { LoginForm } from "@/modules/auth/components/login-form";
import { RegisterForm } from "@/modules/auth/components/register-form";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";
import { MfaForm } from "@/modules/auth/components/mfa-form";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";
import { ONBOARDING_STEPS } from "@/modules/onboarding/steps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Auth screens — preview" };

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Activity className="size-4" />
      </div>
      <span className="font-display text-base font-semibold tracking-tight">
        WorkPulse
      </span>
    </div>
  );
}

/** A framed, non-interactive preview of one screen. */
function ScreenFrame({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-soft",
        wide && "lg:col-span-2",
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/40" />
          <span className="size-2.5 rounded-full bg-warning/50" />
          <span className="size-2.5 rounded-full bg-success/50" />
        </span>
        <figcaption className="ml-1 text-sm font-medium">{title}</figcaption>
      </div>
      <div className="flex flex-col items-center gap-6 bg-muted/40 p-6">
        <Brand />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none w-full select-none",
            wide ? "max-w-xl" : "max-w-sm",
          )}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}

function Gallery() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ScreenFrame title="Sign in">
        <Suspense fallback={<Loader />}>
          <LoginForm />
        </Suspense>
      </ScreenFrame>
      <ScreenFrame title="Create account">
        <RegisterForm />
      </ScreenFrame>
      <ScreenFrame title="Forgot password">
        <ForgotPasswordForm />
      </ScreenFrame>
      <ScreenFrame title="Reset password">
        <ResetPasswordForm />
      </ScreenFrame>
      <ScreenFrame title="Multi-factor verification">
        <MfaForm />
      </ScreenFrame>
      {ONBOARDING_STEPS.map((s, i) => (
        <ScreenFrame
          key={s.key}
          title={`Onboarding · Step ${i + 1} of ${ONBOARDING_STEPS.length}: ${s.title}`}
          wide
        >
          <OnboardingWizard initialStep={i} />
        </ScreenFrame>
      ))}
    </div>
  );
}

export default function AuthPreviewPage() {
  return (
    <div className="min-h-screen bg-muted/30 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <Badge variant="secondary">Design preview</Badge>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Authentication &amp; onboarding
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            A visual sample of the sign-in, account creation, recovery,
            multi-factor, and onboarding screens for review. These previews are
            static; open the
            live, interactive versions to try them. Everything runs on mock data —
            no backend.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button render={<Link href="/login" />} nativeButton={false} size="sm">
              Open Sign in <ArrowUpRight className="size-4" />
            </Button>
            <Button
              render={<Link href="/register" />}
              nativeButton={false}
              size="sm"
              variant="outline"
            >
              Open Create account <ArrowUpRight className="size-4" />
            </Button>
            <Button
              render={<Link href="/onboarding" />}
              nativeButton={false}
              size="sm"
              variant="outline"
            >
              Open Onboarding <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Light theme
          </h2>
          <Gallery />
        </section>

        <section className="dark space-y-4 rounded-3xl bg-background p-6 ring-1 ring-border">
          <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
            Dark theme
          </h2>
          <Gallery />
        </section>
      </div>
    </div>
  );
}
