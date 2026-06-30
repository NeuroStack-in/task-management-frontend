import { redirect } from "next/navigation";

// Personal login & security (password + active sessions) was consolidated into
// the organization Security Center. Keep the old route working.
export default function LoginSecurityPage() {
  redirect("/settings/security");
}
