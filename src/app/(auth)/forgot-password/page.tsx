import { AuthStub } from "@/modules/auth/components/auth-stub";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthStub
      title="Forgot password"
      description="Password recovery is simulated in this demo. In production you'd receive a reset link by email."
    />
  );
}
