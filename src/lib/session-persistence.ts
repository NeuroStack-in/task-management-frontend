/**
 * "Keep me signed in on this device" — honoured.
 *
 * The checkbox was wired to state nothing read: unticked still left a 30-day session in
 * `localStorage`, so on a shared shop-floor PC the next person to open the browser was signed in as
 * the last one (QA audit 2026-10-08, WP-123).
 *
 * Unticked now marks the session **ephemeral** (a `localStorage` flag) and sets a session cookie
 * (no `Expires`, so the browser drops it when it closes; shared by every tab, unlike
 * `sessionStorage`). A page load that finds the flag without the cookie is a new browser session,
 * and the auth store signs out before showing anything.
 */

const EPHEMERAL_KEY = "wp-ephemeral";
const LIVE_COOKIE = "wp_live";

/** Record the choice made at sign-in. Call before the sign-in completes — MFA finishes elsewhere. */
export function markSessionPersistence(remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (remember) window.localStorage.removeItem(EPHEMERAL_KEY);
    else window.localStorage.setItem(EPHEMERAL_KEY, "1");
  } catch {
    // Storage blocked — nothing persists across a browser restart anyway.
  }
  document.cookie = `${LIVE_COOKIE}=1; path=/; SameSite=Lax`;
}

/** Whether this is a new browser session for a sign-in that asked not to be remembered. */
export function ephemeralSessionEnded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(EPHEMERAL_KEY) !== "1") return false;
  } catch {
    return false;
  }
  return !document.cookie.split(";").some((c) => c.trim().startsWith(`${LIVE_COOKIE}=`));
}
