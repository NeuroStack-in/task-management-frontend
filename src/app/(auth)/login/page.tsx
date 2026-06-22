import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/modules/auth/components/login-form";
import { Loader } from "@/components/shared/loader";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader />}>
      <LoginForm />
    </Suspense>
  );
}
