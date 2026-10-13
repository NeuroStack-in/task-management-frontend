"use client";

import { useIsFeatureOn, useIsPageOn } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";

/**
 * The assistant's page key. It is a floating launcher, not a route, so it cannot key off an href —
 * but it is a surface an org may want to hide, so it carries a pseudo-key in the same namespace.
 * The `page:` prefix keeps it unmistakable from a real path.
 */
export const ASSISTANT_PAGE_KEY = "page:assistant";

/**
 * Which assistants this caller may use — the **one** place their gates live.
 *
 * Both need the org's "AI assistant" switch, which Settings → Features flips as a pair: the
 * `ai.assistant` feature (the server's `FeatureGate` refuses every assistant route without it) and
 * the `page:assistant` visibility toggle. Both need `ai:use` (`AiAssistantUse`, the handler's own
 * check). They differ in one bit:
 *
 *   `chat` — the floating assistant: grounded data, org snapshot, tool belt. Also needs `ai:view`,
 *            the oversight bit; an Employee lacks it, which is what the server reads to confine them.
 *   `help` — the Help Center's assistant: product knowledge only, every role.
 *
 * These were checked in three different ways: the Help Center on `ai:use` alone (so Free/Starter
 * members, or an org that switched the assistant off, got a button whose every answer was a 403),
 * and the dashboard/Analytics "Ask the assistant" buttons not at all (QA audit 2026-10-08, WP-319,
 * WP-364). UX only — the server is the boundary.
 */
export function useAssistantAccess(): { chat: boolean; help: boolean } {
  const isFeatureOn = useIsFeatureOn();
  const isPageOn = useIsPageOn();
  const { can } = usePermissions();
  const help = isPageOn(ASSISTANT_PAGE_KEY) && isFeatureOn("ai.assistant") && can("ai:use");
  return { help, chat: help && can("ai:view") };
}
