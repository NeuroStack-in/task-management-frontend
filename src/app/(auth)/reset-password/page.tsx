import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      {/* ResetPasswordForm no longer reads the query string (the email is handed over in
          sessionStorage); the boundary stays, empty — an app Loader here was a second design
          system inside the auth card (UX audit ONB-09). */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
