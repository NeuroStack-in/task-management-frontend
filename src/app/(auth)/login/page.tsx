import { Suspense } from "react";
import type { Metadata } from "next";
import "@/app/marketing.css";
import { LoginExperience } from "@/modules/auth/components/login-experience";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginExperience />
    </Suspense>
  );
}
