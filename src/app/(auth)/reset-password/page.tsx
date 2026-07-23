import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";
import { Loader } from "@/components/shared/loader";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      {/* ResetPasswordForm reads the `email` query param via useSearchParams — needs a Suspense
          boundary to prerender. */}
      <Suspense fallback={<Loader />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
