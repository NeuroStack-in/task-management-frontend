import type { Metadata } from "next";
import { AccountSecuritySettings } from "@/modules/settings/components/account-security-settings";

export const metadata: Metadata = { title: "Login & security · Settings" };

export default function Page() {
  return <AccountSecuritySettings />;
}
