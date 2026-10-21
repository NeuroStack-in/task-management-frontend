import type { AgentOS } from "@/lib/agent-release";

/**
 * What the visitor is browsing the Download page on (UX audit SET-22).
 *
 * - `computer` — one of the three platforms there is an installer for; its card is highlighted.
 * - `mobile` — a phone or tablet. There is no installer for it, so the page says "open this on your
 *   computer" instead of offering three desktop downloads as if one of them would work.
 * - `unknown` — anything else (ChromeOS, an odd user agent): the page shows the plain choice.
 *
 * Detection is a convenience, never a gate: every installer stays one click away whatever this says.
 */
export type DetectedDevice =
  | { kind: "computer"; os: AgentOS }
  | { kind: "mobile" }
  | { kind: "unknown" };

/** The slice of `navigator` this reads — a parameter, so it can be tested without a browser. */
export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  /** User-Agent Client Hints (Chromium only). */
  userAgentData?: { platform?: string; mobile?: boolean };
}

export function detectDevice(nav: NavigatorLike | undefined | null): DetectedDevice {
  if (!nav) return { kind: "unknown" };
  const ua = nav.userAgent ?? "";
  const platform = nav.userAgentData?.platform || nav.platform || "";

  // Mobile first: an Android user agent also says "Linux", and an iPhone's says "like Mac OS X".
  if (nav.userAgentData?.mobile) return { kind: "mobile" };
  if (/Android|iPhone|iPad|iPod|Windows Phone|Mobi/i.test(ua)) return { kind: "mobile" };
  // iPadOS 13+ asks for the desktop site and reports itself as a Mac; a touch screen gives it away.
  if (/Mac/i.test(platform || ua) && (nav.maxTouchPoints ?? 0) > 1) return { kind: "mobile" };

  if (/CrOS|Chrome OS/i.test(ua + " " + platform)) return { kind: "unknown" };
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return { kind: "computer", os: "Windows" };
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) return { kind: "computer", os: "macOS" };
  if (/Linux|X11/i.test(platform) || /Linux|X11/i.test(ua)) return { kind: "computer", os: "Linux" };
  return { kind: "unknown" };
}
