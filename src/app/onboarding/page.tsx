import type { Metadata } from "next";
import { OnboardingExperience } from "@/modules/onboarding/components/onboarding-experience";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return <OnboardingExperience />;
}
