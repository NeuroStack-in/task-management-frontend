import type { Metadata } from "next";
import { NotificationPreferences } from "@/modules/settings/components/notification-preferences";

export const metadata: Metadata = { title: "Notifications · Settings" };

export default function Page() {
  return <NotificationPreferences />;
}
