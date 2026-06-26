import type { Metadata } from "next";
import { AppearanceSettings } from "@/modules/settings/components/appearance-settings";

export const metadata: Metadata = { title: "Appearance · Settings" };

export default function Page() {
  return <AppearanceSettings />;
}
