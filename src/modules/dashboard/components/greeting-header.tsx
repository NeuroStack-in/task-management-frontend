"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { usePageTitle } from "@/stores/page-header.store";

/**
 * Publishes the personalized greeting + date to the top navbar header (in place
 * of the generic "Dashboard" route label). In-page it renders only the page's sr-only `<h1>`: the
 * navbar title is a plain span, so neither dashboard had a heading at all — a screen-reader user
 * jumping by heading landed nowhere (UX audit 2026-10-16, SHELL-07 / XC-10).
 */
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

  const glance = personal
    ? "Here's your day at a glance."
    : "Here's your organization at a glance.";

  usePageTitle(`Hello, ${firstName}`, today ? `${today} · ${glance}` : glance);

  return (
    <h1 className="sr-only">
      {personal ? "Your dashboard" : "Organization dashboard"} — Hello, {firstName}
    </h1>
  );
}
