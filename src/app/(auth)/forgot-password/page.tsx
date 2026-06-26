import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
