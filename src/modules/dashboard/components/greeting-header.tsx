"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";

export function GreetingHeader() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name.split(" ")[0] ?? "there";
  const personal = useIsPersonalDashboard();

  // Resolve the date on the client to avoid an SSR/hydration mismatch.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    );
  }, []);

  return (
    <div className="space-y-1">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Hello, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">
        {today ? `${today} · ` : ""}Here&apos;s your organization at a glance.
        {personal
          ? "Here's your day at a glance."
          : "Here's your organization at a glance."}
      </p>
    </div>
  );
}
