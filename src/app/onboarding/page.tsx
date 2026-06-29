import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/modules/marketing/logo";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/" aria-label="WorkPulse home">
        <Logo />
      </Link>
      <OnboardingWizard />
    </div>
  );
}
