import type { Metadata } from "next";
import { ProfileView } from "@/modules/profile/components/profile-view";

export const metadata: Metadata = { title: "Profile · Settings" };

export default function Page() {
  return <ProfileView />;
}
