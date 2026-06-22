import type { Metadata } from "next";
import { RolesManager } from "@/modules/roles/components/roles-manager";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default function RolesPage() {
  return <RolesManager />;
}
