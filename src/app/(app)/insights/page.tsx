"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { useCurrentRole } from "@/hooks/use-permissions";
import { canAccess } from "@/lib/rbac";
import { Loader } from "@/components/shared/loader";

/** Redirects to the first tab the current role can access. */
export default function InsightsIndex() {
  const router = useRouter();
  const role = useCurrentRole();

  useEffect(() => {
    const first = INSIGHTS_TABS.find((t) => canAccess(role, t.permission));
    if (first) router.replace(first.href);
  }, [role, router]);

  return <Loader label="Opening insights…" />;
}
