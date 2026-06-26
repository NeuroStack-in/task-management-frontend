import type { Metadata } from "next";
import "@/app/marketing.css";
import { SignupExperience } from "@/modules/auth/components/signup-experience";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <SignupExperience />;
}
