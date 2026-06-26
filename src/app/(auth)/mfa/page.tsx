import type { Metadata } from "next";
import { MfaForm } from "@/modules/auth/components/mfa-form";
import { AuthShell } from "@/modules/auth/components/auth-shell";

export const metadata: Metadata = { title: "Verify identity" };

export default function MfaPage() {
  return (
    <AuthShell>
      <MfaForm />
    </AuthShell>
  );
}
