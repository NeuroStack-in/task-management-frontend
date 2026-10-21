import type { Metadata } from "next";
import { RolesManager } from "@/modules/roles/components/roles-manager";

export const metadata: Metadata = { title: "Roles & permissions · Settings" };

export default function Page() {
  return <RolesManager />;
}
