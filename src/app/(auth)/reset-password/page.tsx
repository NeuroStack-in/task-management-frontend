import { AuthStub } from "@/modules/auth/components/auth-stub";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthStub
      title="Reset password"
      description="Set a new password. This flow is simulated for the frontend demo."
    />
  );
}
