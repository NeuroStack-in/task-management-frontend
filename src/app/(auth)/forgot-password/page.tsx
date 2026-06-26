import { redirect } from "next/navigation";

/**
 * Password reset lives inline on /login (see LoginExperience "reset" mode),
 * so this route redirects there to avoid a duplicate flow.
 */
export default function ForgotPasswordPage() {
  redirect("/login");
}
