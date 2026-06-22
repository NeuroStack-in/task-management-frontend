import { AuthStub } from "@/modules/auth/components/auth-stub";

export const metadata = { title: "Create organization" };

export default function RegisterPage() {
  return (
    <AuthStub
      title="Create your organization"
      description="Organization registration runs through onboarding in this demo. Sign in to explore the platform."
    />
  );
}
