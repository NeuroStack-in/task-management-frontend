/**
 * A stable per-browser identity for the session list (`GET/PUT /v1/me/sessions`, identity §15).
 *
 * The server can't tell two browsers apart — Cognito exposes no per-session id, and no IP without its
 * paid tier — so the browser owns the identity it alone knows: a UUID minted once and kept in
 * `localStorage`. Sending it on every sign-in / refresh lets the backend **upsert one row per device**
 * instead of minting a new "Web session" on each authentication (which is the duplicate-rows bug).
 *
 * ⚠️ **Client-only. Never call in a render path.** These touch `localStorage`/`navigator`, which don't
 * exist on the server and (for the id) generate randomness — exactly the SSR/CSR mismatch the repo's
 * hydration rule warns against. Call them inside effects / event handlers. During SSR `getDeviceId`
 * returns "" so a caller can no-op.
 */

const DEVICE_ID_KEY = "wp.device.id";
/** Mirrors the server's `is_valid_device_id`: 8–64 chars of `[A-Za-z0-9._-]`. */
const DEVICE_ID_RE = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * This browser's stable device id — read from `localStorage`, or minted and stored on first use.
 * Returns "" when unavailable (SSR, or storage blocked in a private window) so callers skip the
 * heartbeat rather than throw.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && DEVICE_ID_RE.test(existing)) return existing;

    const raw =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    // `d-` prefix keeps it obviously ours in logs; strip anything outside the server's charset and
    // cap length so the value always satisfies DEVICE_ID_RE.
    const id = `d-${raw}`.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/**
 * A friendly label for this browser ("Chrome on Windows") derived from the user agent. Best-effort —
 * the UA string is all we have; unknown parts are dropped rather than guessed. Shown in the session
 * list, and stored server-side as the row's `user_agent`.
 */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Web session";
  return labelFromUserAgent(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

/**
 * The pure half of {@link deviceLabel}, split out so it can be tested against real UA strings.
 *
 * Order matters twice. iOS is tested **before** macOS because every iOS UA says "like Mac OS X"; and
 * iPadOS 13+ in its default desktop mode sends a plain Macintosh UA, which only a touch screen tells
 * apart. Browsers on iOS name themselves `CriOS`/`FxiOS`/`EdgiOS` rather than `Chrome`/`Firefox`/`Edg`
 * (QA audit 2026-10-08, WP-386).
 */
export function labelFromUserAgent(ua: string, maxTouchPoints = 0): string {
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome\/|CriOS\//.test(ua)
        ? "Chrome"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
      ? "iOS"
      : /Macintosh|Mac OS X/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
