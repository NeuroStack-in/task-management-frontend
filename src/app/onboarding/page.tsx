import Link from "next/link";
import type { Metadata } from "next";
import { Activity } from "lucide-react";
import { OnboardingWizard } from "@/modules/onboarding/components/onboarding-wizard";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
      </Link>
      <OnboardingWizard />
    </div>
  );
}
