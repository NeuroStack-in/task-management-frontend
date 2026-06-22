import { AuthStub } from "@/modules/auth/components/auth-stub";

export const metadata = { title: "Verify identity" };

export default function MfaPage() {
  return (
    <AuthStub
      title="Two-factor verification"
      description="Enter the 6-digit code from your authenticator app. MFA is simulated in this demo."
    />
  );
}
