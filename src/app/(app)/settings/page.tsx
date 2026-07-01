"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/shared/loader";

// The settings hub is a two-pane shell (see layout.tsx). The index has no
// content of its own — redirect to the first account section (Profile) on load,
// including client-side navigation from the sidebar.
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/profile");
  }, [router]);

  return <Loader label="Opening settings…" />;
}
