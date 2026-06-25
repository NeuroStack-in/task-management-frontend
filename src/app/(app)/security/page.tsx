import type { Metadata } from "next";
import { SecurityCenter } from "@/modules/security/components/security-center";

export const metadata: Metadata = { title: "Security Center" };

export default function Page() {
  return <SecurityCenter />;
}
