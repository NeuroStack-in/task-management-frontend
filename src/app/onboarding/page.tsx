import type { Metadata } from "next";
/*
 * The route renders in the sign-up's split frame (`AuthFrame`), so it loads the same two sheets the
 * (auth) layout does. It imported neither: the styles arrived only if an auth page had been visited
 * earlier in the session, and a hard refresh on /onboarding lost them (UX audit 2026-10-16, ONB-13).
 */
import "@/app/marketing.css";
import "@/app/auth.css";
import { OnboardingExperience } from "@/modules/onboarding/components/onboarding-experience";

export const metadata: Metadata = { title: "Set up your organization" };

export default function OnboardingPage() {
  return <OnboardingExperience />;
}
