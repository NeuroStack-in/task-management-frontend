import type { Metadata } from "next";
import { OwnershipSettings } from "@/modules/settings/components/ownership-settings";

export const metadata: Metadata = { title: "Ownership & closure · Settings" };

export default function Page() {
  return <OwnershipSettings />;
}
