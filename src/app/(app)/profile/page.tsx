import { redirect } from "next/navigation";

// Profile now lives inside the Settings shell. Keep the old route working.
export default function ProfilePage() {
  redirect("/settings/profile");
}
