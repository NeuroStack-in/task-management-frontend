import type { Metadata } from "next";
import { MfaForm } from "@/modules/auth/components/mfa-form";

export const metadata: Metadata = { title: "Verify identity" };

export default function MfaPage() {
  return <MfaForm />;
}
