/**
 * Did the person actually *choose* a theme in this browser?
 *
 * `next-themes` persists the active theme under one localStorage key per origin — which is **not**
 * per account. So a single stored `dark` (from anyone who once clicked it, on any account) became the
 * theme every subsequent sign-in saw, on every account, overriding the product's light default.
 *
 * This marker draws the line between "someone picked this" and "this is just what happens to be in
 * storage". `AppearanceSync` uses it on sign-in:
 *
 *   - the account has an explicit `light`/`dark`      → apply it (it follows the user everywhere)
 *   - else the marker is set (they picked in this browser, including "System") → leave it alone
 *   - else                                            → **light**, the product default
 *
 * Set the marker wherever a theme is chosen deliberately (the navbar switcher, Settings →
 * Appearance) — never on a programmatic apply, or it stops meaning anything.
 */

const CHOSEN_KEY = "wp-theme-chosen";

/** Record that the user picked a theme in this browser. */
export function markThemeChosen() {
  try {
    window.localStorage.setItem(CHOSEN_KEY, "1");
  } catch {
    /* storage blocked — the pick still applies for this session */
  }
}

/** Has the user picked a theme in this browser? Client-only. */
export function hasChosenTheme(): boolean {
  try {
    return window.localStorage.getItem(CHOSEN_KEY) === "1";
  } catch {
    return false;
  }
}
