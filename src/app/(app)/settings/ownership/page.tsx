import type { Metadata } from "next";
import { OwnershipSettings } from "@/modules/settings/components/ownership-settings";

export const metadata: Metadata = { title: "Ownership & deletion · Settings" };

export default function Page() {
  return <OwnershipSettings />;
}
