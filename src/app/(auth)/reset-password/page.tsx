import type { Metadata } from "next";
import { ResetPasswordForm } from "@/modules/auth/components/reset-password-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
