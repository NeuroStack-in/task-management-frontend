"use client";

import { useAuthStore } from "@/stores/auth.store";

export function GreetingHeader() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-1">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Hello, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here&apos;s your organization at a glance.
      </p>
    </div>
  );
}
