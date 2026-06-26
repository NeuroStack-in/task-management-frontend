import type { Metadata } from "next";
import { NotificationsCenter } from "@/modules/notifications/components/notifications-center";

export const metadata: Metadata = { title: "Notification Center" };

export default function Page() {
  return <NotificationsCenter />;
}
